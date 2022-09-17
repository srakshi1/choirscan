var canvasScale = 1;
var seatScale = 1;
var maxRows = 8;
var spectrumInitialized = false;
var editingColor = false;
var centerX;
var centerY;
var editingLabelRow;
var defaultPalette;
var userPalette = [];
var podium = {};

var band;
var jsonVersion = 6;

$(document).ready(function() {
	setCanvasScale(1);

	$.jCanvas.defaults.strokeStyle = '#000';
	$.jCanvas.defaults.inDegrees = false;

	$('input').change(drawChart);
	$('#code').unbind('change');
	$('#generate').click(drawChart);
	$('#loadlink').click(function() {
		$('#loadlink').addClass('hidden');
		$('#loadcontainer').removeClass('hidden');
	});
	$('#load').click(function() {
		loadChartFileText($('#loadcode').val(), false);
	});
	$('#fileinput').change(loadChartFile);
	$('#reset').click(promptReset);
	$('#btncolorreset').click(promptResetColors);

	// The guide canvas is set to ignore pointer events in supported browsers so that the "real" canvas
	// will be saved if the user right clicks the chart to save it. (Without the gray chairs/stands.)
	// Bind the click events to whichever canvas will end up receiving the clicks first.
	var clickCanvas = $('#guide_canvas')[0].style['pointer-events'] === undefined ? $('#guide_canvas') : $('#canvas');
	clickCanvas.click(clickChart);
	clickCanvas.bind('contextmenu', rightClickChart);

	$('#btnscaledown').click(function() {
		setCustomScale(-0.1);
		drawChart();
	});
	$('#btnscaleup').click(function() {
		setCustomScale(0.1);
		drawChart();
	});
	$('#btnrowlabelscaledown').click(function() {
		band.customRowFontSizes[editingLabelRow] *= 0.9;
		setCustomLabels();
	});
	$('#btnrowlabelscaleup').click(function() {
		band.customRowFontSizes[editingLabelRow] *= 1.111111111;
		setCustomLabels();
	});
	$('#btnstraightdown').click(function() {
		setStraight(-1);
		drawChart();
	});
	$('#btnstraightup').click(function() {
		setStraight( 1);
		drawChart();
	});
	$('#txtlabels').blur(setCustomLabels);
	$('#txtlabels').keypress(function(e) {
		if(e.which == 13)
			setCustomLabels();
	});
	$('#txtlabels').keydown(function(e) {
		if(e.keyCode == 38 || e.keyCode == 40) // up, down arrows
			setCustomLabels();
	});
	$('#btnlabeldone').click(editLabelsDone);
	$('#btncolordone').click(editColorsDone);
	$('#notes').on('keyup', resizeNotes);
	$('#notes').change(readInputs);

	$('#code').click(function () {
		$(this).select();
	});
	$('#help').click(closeHelp);
	$('#helpcontents').click(function(e) { e.stopPropagation(); });
	$('#link-popup .popup-close').click(function(e) {
		$('#link-popup').hide();
	});

	if(!window.FileReader) {
		$('#loadfilecontainer').hide();
		showCodeInput();
	}

	bindPrintEvents();
	reset();
	drawChart();
	loadUrlCode();

	// If print mode is requested, only show the chart (for PDF generation)
	if(document.URL.indexOf("print") > -1) {
		$('#printcss').attr('media', 'all');
		beforePrint();
		$('.title').css('font-size', (32 * canvasScale) + 'px');
		$('#notes').css('font-size', (16 * canvasScale) + 'px');
		$('#notes').css('margin-top', (20 * canvasScale) + 'px');
		$('#notes').css('margin-left', (30 * canvasScale) + 'px');
		$('#notes').width((800 * canvasScale) + 'px');
		resizeNotes();
		// Adjust the top margin based on how long the notes are to try to keep things centered in the PDF.
		// The more notes there are, the smaller the top margin gets.
		$('#wrapper').css('margin-top', Math.max((170 * canvasScale) - $('#notes').height(), 0) / 2 + 'px');
	}
});

function drawChart() {
	readInputs();
	updateChairLabels();

	$("canvas").clearCanvas();
	if(band.showNumbers)
		var n = 1;
	else
		var n = '';
	var a = '';
	seatScale = Math.min(1, 7 / band.rows.length) * band.customScale;
	var step = 300 / (band.rows.length - 1);
	var row_length = 0;
	for(var row in band.rows) {
		if(band.restartNumbering)
			n = 1;
		if(band.letterRows)
			a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.charAt(row);
		var r = 350 * canvasScale;
		if(band.rows.length > 1)
			r = (185 + step * row) * canvasScale;
		if(row < band.rows.length - band.straightRows) {
			$('canvas').drawArc({ radius: r, x: centerX, y: centerY });
			var arc_length = Math.acos(80 * canvasScale / r) * 2;
			var angle_step = arc_length / (band.rows[row] - 1);
			for(var i = 0; i < band.rows[row]; i++) {
				var t = 0;
				if(band.rows[row] > 1)
					t = -1 * (-1 * arc_length / 2 + angle_step * i);
				// Hide the arc under disabled chairs
				if(!band.chairs[row][i].enabled) {
					$('canvas').drawArc({
						x: centerX,
						y: centerY,
						radius: r,
						strokeStyle: '#fff',
						strokeWidth: 5 * canvasScale,
						start: i == 0 ? Math.PI : ((t + angle_step * 0.55) * -1), // First chair, blank out entire arc to the left
						end: i == band.rows[row] - 1 ? Math.PI : ((t - angle_step * 0.55) * -1)  // Last chair, blank out entire arc to the right
					});
				}
				drawChair(r, t, n, a, band.chairs[row][i]);
				if(band.showStands) {
					drawStand(Math.max(r - step * 0.5 * canvasScale, r - 35 * band.customScale * canvasScale), t, band.stands[row][i*2]);
					if(i != band.rows[row] - 1)
						drawStand(Math.max(r - step * 0.5 * canvasScale, r - 35 * band.customScale * canvasScale), t - angle_step / 2, band.stands[row][i*2+1]);
				}
				if(band.showNumbers && band.chairs[row][i].enabled && band.chairs[row][i].label === false)
					n++;
			}
		} else {
			var y = centerY - r;
			if(!row_length) {
				if(band.rows.length > band.straightRows)
					row_length = r * 1.8;
				else
					row_length = 1000 * canvasScale;

			}
			$('canvas').drawLine({ x1: centerX - row_length/2, y1: y, x2: centerX + row_length/2, y2: y });
			var x_step = (row_length - 100 * canvasScale) / (band.rows[row] - 1);
			for(var i = 0; i < band.rows[row]; i++) {
				var x = centerX;
				if(band.rows[row] > 1)
					x = x_step * i + centerX - row_length/2 + 50 * canvasScale;
				// Hide the line under disabled chairs
				if(!band.chairs[row][i].enabled) {
					$('canvas').drawLine({
						x1: i == 0 ? 0 : (x - x_step * 0.55), // First chair, blank out entire line to the left
						y1: y,
						x2: i == rows[row] - 1 ? centerX * 2 : (x + x_step * 0.55), // Last chair, blank out entire line to the right
						y2: y,
						strokeStyle: '#fff',
						strokeWidth: 5
					});
				}
				drawChairXY(x, y, 0, n, a, band.chairs[row][i]);
				if(band.showStands) {
					drawStandXY(x, Math.min(y + step * 0.5 * canvasScale, y + 35 * band.customScale * canvasScale), band.stands[row][i*2]);
					if(i != band.rows[row] - 1)
						drawStandXY(x + x_step * 0.5, Math.min(y + step * 0.5 * canvasScale, y + 35 * band.customScale * canvasScale), band.stands[row][i*2+1]);
				}
				if(band.showNumbers && band.chairs[row][i].enabled && band.chairs[row][i].label === false)
					n++;
			}
		}
	}
	if(band.showStands) {
		$('canvas').drawText({
			fillStyle: '#000',
			strokeStyle: '#fff',
			strokeWidth: 0,
			x: 166 * canvasScale, y: 8 * canvasScale,
			text: ' = music stand',
			fontSize: (11 * canvasScale) + 'pt',
			fontFamily: 'Verdana, sans-serif',
			rotate: band.flip ? Math.PI : 0
		});
		var xAdjust = band.flip ? 120 : 0; // When the chart is flipped, the 'x' symbol needs to be moved to the other side of the caption
		$('canvas').drawLine({ x1: (102 + xAdjust) * canvasScale, y1: 2 * canvasScale, x2: (112 + xAdjust) * canvasScale, y2: 12 * canvasScale });
		$('canvas').drawLine({ x1: (102 + xAdjust) * canvasScale, y1: 12 * canvasScale, x2: (112 + xAdjust) * canvasScale, y2: 2 * canvasScale });
	}

	if(band.rows.length > 0)
		drawPodium();

	$('.title').html($('#title').val());

	var transformProperties = ['transform', '-ms-transform', '-moz-transform', '-webkit-transform', '-o-transform'];
	for(var i in transformProperties)
		$('canvas').css(transformProperties[i], band.flip ? 'rotate(180deg)' : 'none');

	showDebug();

	// Hide the bottom code box since the chart probably changed.
	// (The bottom code box almost never used, only if there is an error saving to the database.)
	$('#helpsave').hide();
	// Also hide the bottom message since it might contain a link with an outdated hash
	$('#bottommessage').hide();
	$('#link-popup').hide();
}

function drawChair(r, t, n, a, chair) {
	var x = centerX - Math.sin(t) * r;
	var y = centerY - Math.cos(t) * r;
	drawChairXY(x, y, t, n, a, chair);
}

function drawChairXY(x, y, t, n, a, chair) {
	//console.log('chair ' + x + ' ' + y);
	chair.x = x;
	chair.y = y;
	var fontSize = (chair.fontSize ? chair.fontSize : 1) * Math.round((a ? 14 : 16) * seatScale) * canvasScale;
	var textRotate = band.flip ? Math.PI : 0;
	var chairColor = band.colorChairs && chair.color ? chair.color : '#000';
	var chairFillColor = chair.fillColor ? chair.fillColor : '#fff';
	var textColor = band.colorLabels && chair.color ? chair.color : '#000';
	// The black borders don't work in old Firefoxen.
	// So fake it by drawing two rectangles
	if(chair.enabled) {
		$('canvas').drawRect({
			fillStyle: chairColor,
			strokeStyle: chairColor,
			x: x, y: y,
			width: 40 * canvasScale * seatScale, height: 40 * canvasScale * seatScale,
			rotate: -1 * t
		});
		$('canvas').drawRect({
			fillStyle: chairFillColor,
			strokeStyle: chairFillColor,
			x: x, y: y,
			width: (40 * seatScale - 4) * canvasScale, height: (40 * seatScale - 4) * canvasScale,
			rotate: -1 * t
		});
		// Draw text with a thick white border first
		$('canvas').drawText({
			fillStyle: chairFillColor,
			strokeStyle:chairFillColor,
			strokeWidth: 4 * canvasScale,
			x: x, y: y,
			text: chair.label === false ? a + n : chair.label,
			fontSize: fontSize + 'pt',
			fontFamily: 'Verdana, sans-serif',
			rotate: textRotate
		});
		// Then draw thin black text on top
		$('canvas').drawText({
			fillStyle: textColor,
			strokeStyle: textColor,
			strokeWidth: 0,
			x: x, y: y,
			text: chair.label === false ? a + n : chair.label,
			fontSize: fontSize + 'pt',
			fontFamily: 'Verdana, sans-serif',
			rotate: textRotate
		});
	} else {
		$('#guide_canvas').drawRect({
			fillStyle: '#CCC',
			strokeStyle: '#CCC',
			x: x, y: y,
			width: 40 * canvasScale * seatScale, height: 40 * canvasScale * seatScale,
			rotate: -1 * t
		});
		$('#guide_canvas').drawRect({
			fillStyle: '#fff',
			strokeStyle: '#fff',
			x: x, y: y,
			width: (40 * seatScale - 4) * canvasScale, height: (40 * seatScale - 4) * canvasScale,
			rotate: -1 * t
		});
	}
	//console.log(x + ' ' + y + ' ' + t);
}

function drawStand(r, t, stand) {
	var x = centerX - Math.sin(t) * r;
	var y = centerY - Math.cos(t) * r;
	drawStandXY(x, y, stand);
}

function drawStandXY(x, y, stand) {
	stand.x = x;
	stand.y = y;
	// Again with the borders
	$('#guide_canvas').drawRect({
		fillStyle: '#999',
		strokeStyle: '#999',
		x: x, y: y,
		width: 8 * canvasScale, height: 8 * canvasScale
	});
	$('#guide_canvas').drawRect({
		fillStyle: '#fff',
		strokeStyle: '#fff',
		x: x, y: y,
		width: 6 * canvasScale, height: 6 * canvasScale
	});
	if(stand.enabled) {
		$('canvas').each(function() {
			$(this).drawLine({
				x1: x - 5 * canvasScale, y1: y - 5 * canvasScale,
				x2: x + 5 * canvasScale, y2: y + 5 * canvasScale
			});
			$(this).drawLine({
				x1: x - 5 * canvasScale, y1: y + 5 * canvasScale,
				x2: x + 5 * canvasScale, y2: y - 5 * canvasScale
			});
		});
	}
}

function drawPodium() {
	var color = band.showPodium ? '#000' : '#CCC';
	var canvas = band.showPodium ? $('canvas') : $('#guide_canvas');

	podium.x = centerX;
	podium.y = centerY - 71 * canvasScale;
	podium.w = 90 * canvasScale;
	podium.h = 60 * canvasScale;
	podium.standX = podium.x;
	podium.standY = podium.y - 40 * canvasScale;

	canvas.drawRect({
		fillStyle: color,
		strokeStyle: color,
		x: podium.x, y: podium.y,
		width: podium.w, height: podium.h
	});
	canvas.drawRect({
		fillStyle: '#fff',
		strokeStyle: '#fff',
		x: podium.x, y: podium.y,
		width: podium.w - 4 * canvasScale, height: podium.h - 4 * canvasScale
	});

	if(band.showPodium) {
		$('canvas').drawText({
			fillStyle: color,
			strokeStyle: color,
			strokeWidth: 0,
			x: podium.x, y: podium.y,
			text: 'Podium',
			fontSize: (14 * canvasScale) + 'pt',
			fontFamily: 'Verdana, sans-serif',
			rotate: band.flip ? Math.PI : 0
		});
	} else {
		$('#guide_canvas').drawText({
			fillStyle: color,
			strokeStyle: color,
			strokeWidth: 0,
			x: podium.x, y: podium.y,
			text: "Click to\nenable\npodium",
			fontSize: (12 * canvasScale) + 'pt',
			fontFamily: 'Verdana, sans-serif',
			rotate: band.flip ? Math.PI : 0
		});
	}

	if(band.showStands)
		drawStandXY(podium.standX, podium.standY, { enabled: band.showPodiumStand });
}

function clickChart(e, rightClick) {
	var coordinates = transformClickCoordinates(e.pageX, e.pageY);
	var x = coordinates.x;
	var y = coordinates.y;

	if(!editingColor && x > podium.x - podium.w / 2 && x < podium.x + podium.w / 2 && y > podium.y - podium.h / 2 && y < podium.y + podium.h / 2) {
		band.showPodium = !band.showPodium;
	} else if (!editingColor && band.showStands && x > podium.standX - 9 * canvasScale && x < podium.standX + 9 * canvasScale && y > podium.standY - 9 * canvasScale && y < podium.standY + 9 * canvasScale) {
		band.showPodiumStand = !band.showPodiumStand;
	} else {
		for(var row in band.rows) {
			for(var c in band.chairs[row]) {
				var chair = band.chairs[row][c];
				if(chair.x > x - 18 * canvasScale && chair.x < x + 18 * canvasScale && chair.y > y - 18 * canvasScale && chair.y < y + 18 * canvasScale) {
					clickChair(chair, rightClick);
					break;
				}
			}
			if(!band.showStands)
				continue;
			for(var s in band.stands[row]) {
				var stand = band.stands[row][s];
				if(stand.x > x - 9 * canvasScale && stand.x < x + 9 * canvasScale && stand.y > y - 9 * canvasScale && stand.y < y + 9 * canvasScale) {
					clickStand(stand);
					break;
				}
			}
		}
	}
	drawChart();
}

function clickChair(chair, rightClick) {
	if(editingColor) {
		var color = $('#colorpicker').spectrum('get').toHexString();
		if(rightClick)
			chair.fillColor = color;
		else
			chair.color = color;
		addMruColor(color);
	} else {
		chair.enabled = !chair.enabled;
	}
}

function clickStand(stand) {
	if(!editingColor)
		stand.enabled = !stand.enabled;
}

function rightClickChart(e) {
	if(editingColor) {
		clickChart(e, true);
		return false;
	}
}

// Transform page coordinates to canvas coordinates
function transformClickCoordinates(x, y) {
	var canvas = $('#guide_canvas');
	var scale = 1050 / canvas.width();
	var x = (x - canvas.offset().left) * scale * canvasScale;
	var y = (y - canvas.offset().top) * scale * canvasScale;

	if(band.flip) {
		x = 1050 * canvasScale - x;
		y = 510 * canvasScale - y;
	}
	//console.log(x, y);

	return { x: x, y: y };
}

function editLabels(row) {
	editingLabelRow = row - 1;
	$('#input_main').hide();
	$('#input_labels').show();
	$('#lblcustomrow').html(row);
	$('#txtlabels').val(band.labels[editingLabelRow] ? band.labels[editingLabelRow].join("\n") : "");
}

function setCustomLabels() {
	if ($('#txtlabels').val().trim() == "") {
		delete band.labels[editingLabelRow];
		delete band.customRowFontSizes[editingLabelRow];
	} else {
		band.labels[editingLabelRow] = $('#txtlabels').val().trim().replace(/\|/g, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
		if(!band.customRowFontSizes[editingLabelRow])
			band.customRowFontSizes[editingLabelRow] = 0.7;
	}
	drawChart();
}

function updateChairLabels() {
	for(var row in band.rows) {
		var label = 0;
		for(var c in band.chairs[row]) {
			var chair = band.chairs[row][c];
			chair.fontSize = band.customRowFontSizes[row];
			if(band.labels[row]) {
				if (chair.enabled) {
					chair.label = band.labels[row][label] ? band.labels[row][label].replace(/\\n/g, "\n").replace(/<br>/g, "\n").replace(/%/g, "\n") : "";
					label++;
				}
			} else {
				chair.label = false;
			}
		}
	}
}

function editLabelsDone() {
	$('#input_labels').hide();
	$('#input_main').show();
}

function resizeNotes() {
	var notes = $('#notes')[0];
	notes.style.height = '';
	var height = (notes.scrollHeight + 5);
	notes.style.height = height + 'px';
	if(height > 180)
		$('#notestitle').html('<strong>Notes</strong> (to appear below printed chart)&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: red;">The notes might be too long to fit on the printed page</span>');
	else
		$('#notestitle').html('<strong>Notes</strong> (to appear below printed chart)');
}

function editColors() {
	if(!spectrumInitialized) {
		defaultPalette = [['#000', '#666'], ['#f00', '#900'], ['#f90', '#bf9000'], ['#0d0', '#38761d'], ['#08f', '#00f'], ['#d0d', '#90f']];
		$('#colorpicker').spectrum({
			flat: true,
			color: 'black',
			showButtons: false,
			showPalette: true,
			showSelectionPalette: false,
			palette: defaultPalette,
			showInitial: true
		});

		var chartColors = getChartColors();
		for(var i = 0; i < chartColors.length; i++)
			addMruColor(chartColors[i]);

		spectrumInitialized = true;
	}

	editingColor = true;
	$('canvas').css('cursor', 'crosshair');
	$('#input_main').hide();
	$('#input_colors').show();
}

function editColorsDone() {
	$('canvas').css('cursor', 'auto');
	$('#input_colors').hide();
	$('#input_main').show();
	editingColor = false;
}

function addMruColor(color) {
	var colorExists = false;
	var fullPalette = defaultPalette.concat([userPalette]);
	for(var i = 0; i < fullPalette.length; i++) {
		for(var j = 0; j < fullPalette[i].length; j++) {
			if(tinycolor(fullPalette[i][j]).toHexString() == tinycolor(color).toHexString())
				return;
		}
	}

	var maxUserColors = 8;
	userPalette.unshift(color);
	// If the MRU palette is too big, first try to remove a color that's not currently
	// being used in the chart itself
	if(userPalette.length > maxUserColors) {
		var chartColors = getChartColors();
		for(var i = userPalette.length - 1; i >= 0; i--) {
			if(chartColors.indexOf(userPalette[i]) == -1) {
				userPalette.splice(i, 1);
				break;
			}
		}
		// If all colors are used in the chart, just remove the last one
		if(userPalette.length > maxUserColors)
			userPalette.pop();
	}
	$('#colorpicker').spectrum('option', 'palette', defaultPalette.concat([userPalette]));
}

function getChartColors() {
	var chartColors = [];
	for(var row in band.rows) {
		for(var c in band.chairs[row]) {
			var color = band.chairs[row][c].color;
			if(color && color != '#000000' && chartColors.indexOf(color) == -1)
				chartColors.push(color);

			color = band.chairs[row][c].fillColor;
			if(color && color != '#000000' && chartColors.indexOf(color) == -1)
				chartColors.push(color);
		}
	}
	return chartColors;
}

function addRow() {
	maxRows++;
	$('#rows').append("<p>Riser " + maxRows + ": <input id='row" + maxRows + "' size='2' maxlength='2'></input><a class='editlabellink' href='javascript:editLabels(" + maxRows + ")'>Enter heights and voice parts</a></p>");
	$('#row' + maxRows).change(drawChart);
}

function promptReset() {
	if(window.confirm("Are you sure you want to completely reset the chart?"))
		reset();
}

function reset() {
	band = {
		version: jsonVersion,
		colorChairs: true,
		colorLabels: true,
		customScale: 1.0,
		flip: false,
		letterRows: false,
		restartNumbering: false,
		showNumbers: true,
		showStands: false,
		straightRows: 0,
		title: '',
		notes: '',
		showPodium: false,
		showPodiumStand: true,
		chairs: [],
		rows: [],
		stands: [],
		labels: [],
		customRowFontSizes: []
	};

	updateInputs();
	drawChart();
}

function promptResetColors() {
	if(window.confirm("Are you sure you want to remove assigned colors from all chairs?")) {
		for(var row in band.chairs) {
			for(var c in band.chairs[row]) {
				band.chairs[row][c].color = false;
				band.chairs[row][c].fillColor = false;
			}
		}
	}
	drawChart();
}

function readInputs() {
	setInputEnabledState();

	band.title = $('#title').val();
	band.notes = $('#notes').val();
	band.colorChairs = $('#chkchaircolor').attr('checked') != null;
	band.colorLabels = $('#chklabelcolor').attr('checked') != null;
	band.flip = $('#chkflip').attr('checked') != null;
	band.letterRows = $('#chkletters').attr('checked') != null;
	band.restartNumbering = $('#chkrestart').attr('checked') != null;
	band.showNumbers = $('#chknumbers').attr('checked') != null;
	band.showStands = $('#chkstands').attr('checked') != null;

	band.rows = [];
	for(var i = maxRows - 1; i >= 0; i--) {
		var val = parseInt($('#row' + (i+1)).val());
		if(band.rows.length == 0 && !val)
			continue;
		if(!val)
			val = 0;
		band.rows.push(val);
		if(!band.chairs[i] || band.chairs[i].length != val) {
			band.chairs[i] = [];
			for(var j = 0; j < val; j ++) {
				band.chairs[i][j] = { enabled: true, x: 0, y: 0, label: false, fontSize: false, color: false, fillColor: false };
			}
		}
		if(!band.stands[i] || band.stands[i].length != val * 2 - 1) {
			band.stands[i] = [];
			for(var j = 0; j < val * 2 - 1; j += 2) {
				band.stands[i][j] = { enabled: true, x: 0, y: 0 };
				if(j != val * 2 - 2)
					band.stands[i][j+1] = { enabled: false, x: 0, y: 0 };
			}
		}
	}
	band.rows.reverse();
	setStraight(0); // Re-run "max straight rows" logic in case rows were removed
}

function updateInputs() {
	$('input:text').not('#loadcode').val('');
	for(var r in band.rows) {
		var rowId = '#row' + (parseInt(r, 10) + 1);
		if($(rowId).length == 0)
			addRow();
		$(rowId).val(band.rows[r]);
	}
	$('#scale').html(Math.round(band.customScale * 100));
	$('#straight').html(band.straightRows);
	$('#title').val(band.title);
	$('#notes').val(band.notes);
	setChecked($('#chkchaircolor'), band.colorChairs);
	setChecked($('#chklabelcolor'), band.colorLabels);
	setChecked($('#chkflip'), band.flip);
	setChecked($('#chkletters'), band.letterRows);
	setChecked($('#chkrestart'), band.restartNumbering);
	setChecked($('#chknumbers'), band.showNumbers);
	setChecked($('#chkstands') , band.showStands);

	resizeNotes();

	if(band.showStands) {
		$('#helpstands').show();
	} else {
		$('#helpstands').hide();
	}
}

function setChecked(e, checked) {
	if(checked)
		e.attr('checked', 'checked');
	else
		e.removeAttr('checked');
}

function setInputEnabledState() {
	if($('#chknumbers').attr('checked')) {
		$('#lblrestart').removeClass('disabled');
		$('#chkrestart').removeAttr('disabled');
	} else {
		$('#lblrestart').addClass('disabled');
		$('#chkrestart').attr('disabled', 'disabled').removeAttr('checked');
	}
	if($('#chkrestart').attr('checked')) {
		$('#lblletters').removeClass('disabled');
		$('#chkletters').removeAttr('disabled');
	} else {
		$('#lblletters').addClass('disabled');
		$('#chkletters').attr('disabled', 'disabled').removeAttr('checked');
	}
}

function setCustomScale(n) {
	band.customScale = Math.min(2, Math.max(0.5, (band.customScale + n).toFixed(1)));
	updateInputs();
}

function setStraight(n) {
	band.straightRows = Math.min(band.rows.length, Math.max(0, band.straightRows + n));
	updateInputs();
}

function validate() {
	var valid = band.rows.length > 0;
	if(!valid) {
		$('#bottommessage').show().html("<span style='color: red;'>Please create a chart first</span>");
	}
	return valid;
}

function save() {
	if (!validate())
		return;
	$('#bottommessage').show().html("<span style='color: green;'>Please wait...</span>");
	$.post('save.php?action=save&format=txt', {code: encode(false)}, null, 'text')
		.done(function(data) {
			$('#bottommessage').html("<span style='color: green;'>Click <a href='" + data + "'>here</a> to save the chart data file to your computer.<br>When you return to this page later, you can open the file by clicking the Load Saved Chart button at the top of the page.</span>");
		})
		.fail(function(xhr) {
			drawChart();
			showSaveErrorHelp('Sorry, there was an error saving the chart.', xhr);
		});
}

function savePdf() {
	if (!validate())
		return;
	$('#bottommessage').show().html("<span style='color: green;'>Preparing PDF, please wait...</span>");
	$.post('save.php?action=save&format=pdf', {code: encode(false)}, null, 'text')
		.done(function(data) {
			$('#bottommessage').html("<span style='color: green;'>Done!<br>If the download does not start after 10 seconds, click <a href='" + data + "'>here</a>.</span>");
			window.location.href = data;
		})
		.fail(function(xhr) {
			drawChart();
			showSaveErrorHelp('Sorry, there was an error generating the PDF.', xhr);
		});
}

function link() {
	if (!validate())
		return;
	$('#bottommessage').show().html("<span style='color: green;'>Please wait...</span>");
	$.post('save.php?action=email', {code: encode(false)}, null, 'text')
		.done(function(data) {
			$('#bottommessage').hide();
			$('#link-popup').show();
			$('#link').val(data).focus().select();
		})
		.fail(function(xhr) {
			showSaveErrorHelp('Sorry, there was an error generating a link to this chart.', xhr);
		});
}

function email() {
	if (!validate())
		return;
	$('#bottommessage').show().html("<span style='color: green;'>Please wait...</span>");
	$.post('save.php?action=email', {code: encode(false)}, null, 'text')
		.done(function(data) {
			$('#bottommessage').hide();
			var subject = $('#title').val() ? encodeURIComponent($('#title').val()) : "Seating Chart";
			window.location.href = "mailto:?to=&subject=" + subject + "&body=" + encodeURIComponent("Here is a link to a seating chart I made: ") + data + "";
		})
		.fail(function(xhr) {
			showSaveErrorHelp('Sorry, there was an error generating a link to this chart.', xhr);
		});
}

function showSaveErrorHelp(message, xhr) {
	if(xhr.readyState == 0) {
		message += ' Please check your internet connection and try again.';
	} else {
		$('#helpsave').show();
		$('#code').html(xhr.responseText + "\n\n" + encode(true));
	}
	$('#bottommessage').show().html("<span style='color: red;'>" + message + "</span>");
}

function showCodeInput() {
	$('#loadcodecontainer').show();
	$('#loadcodelabel').hide();
}

function loadChartFile() {
	var reader = new FileReader();
	reader.onload = function() {
		loadChartFileText(this.result, true);
	};
	reader.readAsText($(this)[0].files[0]);
}

function loadChartFileText(text, isFile) {
	$('#loadmessage').hide();

	// First check if the file is a PDF
	if(text.substring(0, 4) == "%PDF") {
		// If it is, look for the magic string that marks the chart ID.
		// I don't know if the PDF format guarantees it to always be plain text, but it always has
		// been in my tests of PDFs created with ImageMagick. Since this seems to work all right,
		// just do it this way instead of including a large PDF Javascript library.
		var hash = text.substring(text.indexOf("ChartId:") + 8, text.indexOf(":ChartId"));
		// Basic sanity check
		if(hash.length < 20 || hash.length > 100) {
			$('#loadmessage').show().html('<br>' + (isFile ? 'The selected file' : 'The entered code') + ' does not contain valid chart data');
			return;
		}
		window.location.href = '/band/' + hash;
	} else {
		text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
		var start = text.indexOf("-- BEGIN CHART DATA --\n") + 23;
		var end = text.indexOf("\n-- END CHART DATA --");
		if(start > -1 && end > -1) {
			text = text.substring(start, end);
		}

		// Try JSON first. If it fails, it's probably an old-style code.
		try {
			band = JSON.parse(text);
			upgradeJson();
			updateInputs();
			drawChart();
		} catch(e) {
			if (text.indexOf("\n") > -1) {
				$('#loadmessage').show().html('<br>' + (isFile ? 'The selected file' : 'The entered code') + ' does not contain valid chart data');
				return;
			}
			decodeV1(text);
		}
	}
}

function loadUrlCode() {
	if(window.urlcodeerr)
		$('#loadmessage').show().html('<br>' + urlcodeerr);
	else if(window.urlcode)
		loadChartFileText(urlcode, false);
}

function upgradeJson() {
	if(band.version < 3) // flip added in version 3
		band.flip = false;
	if(band.version < 4) {
		band.colorChairs = true;
		band.colorLabels = true;
	}
	if(band.version < 5)
		band.notes = '';
	if(band.version < 6) {
		band.showPodium = false;
		band.showPodiumStand = true;
	}
}

function encode(format) {
	// Ensure the JSON is tagged with the correct version (might not be if the current chart is a modification of an old chart)
	band.version = jsonVersion;

	// Make a copy so we can remove data that can be recomputed
	var bandSmall = JSON.parse(JSON.stringify(band));

	var hiddenChairExists = false;
	for(var row in bandSmall.chairs) {
		if(!(row in bandSmall.rows)) {
			bandSmall.chairs.splice(row, 1); // Delete extra data left over from removed row
		} else {
			for(var c in bandSmall.chairs[row]) {
				if(!bandSmall.chairs[row][c].enabled)
					hiddenChairExists = true;
				delete bandSmall.chairs[row][c].x;
				delete bandSmall.chairs[row][c].y;
				delete bandSmall.chairs[row][c].fontSize;
				delete bandSmall.chairs[row][c].label;
			}
		}
	}
	if(!hiddenChairExists && getChartColors().length == 0)
		bandSmall.chairs = [];

	if(bandSmall.showStands) {
		for(var row in bandSmall.stands) {
			if(!(row in bandSmall.rows)) {
				bandSmall.stands.splice(row, 1); // Delete extra data left over from removed row
			} else {
				for(var s in bandSmall.stands[row]) {
					delete bandSmall.stands[row][s].x;
					delete bandSmall.stands[row][s].y;
				}
			}
		}
	} else {
		bandSmall.stands = [];
	}

	if(format)
		return JSON.stringify(bandSmall, null, 4);
	else
		return JSON.stringify(bandSmall);
}

function decodeV1(code) {
	reset();
	var parts = code.split("|||");
	code = parts[0];

	// Simple settings before the row data begins
	var matches = code.match(/^([^R]*)/);
	if(matches != null && matches.length > 1) {
		// Simple checkboxes
		band.showNumbers = matches[1].indexOf('H') == -1;
		if(matches[1].indexOf('N') > -1) {
			band.restartNumbering = true;
			if(matches[1].indexOf('L') > -1)
				band.letterRows = true;
		}

		// Seat scale
		var scaleMatches = matches[1].match(/P(\d+)/);
		if(scaleMatches != null && scaleMatches.length > 1) {
			band.customScale = +((parseInt(scaleMatches[1], 10) / 100).toFixed(1));
		}
	}
	var standMatches = code.match(/S([^,]*)/);
	if(standMatches != null && standMatches.length > 1)
		band.showStands = true;

	// Rows
	var matches = code.match(/R([\d\.]*)/);
	if(matches != null && matches.length > 1) {
		for(var i = 0; i < matches[1].length; i+= 2) {
			var val = matches[1].substring(i, i+2);
			//console.log(val);
			band.rows.push(parseInt(val, 10));
		}
	}

	// Straight rows
	var matches = code.match(/,T([^,]*)/);
	if(matches != null && matches.length > 1) {
		band.straightRows = parseInt(matches[1], 10);
	}

	// Chart title
	if(parts.length > 1)
		band.title = parts[1];

	// Custom labels
	if(parts.length > 2) {
		//First, repair the label string by joining it back together. Blank labels can introduce extra "|||" sequences.
		//Keeping this behavior for compatibility with existing charts
		var labelCode = "||" + parts.slice(2).join("|||")
		//Split by row. Detect row breaks with the ||n:n.n pattern since I forgot that blank names will produce "||" in the pattern
		var rowLabels = labelCode.split(/\|\|(\d+:[\d\.]+)\|/);
		for (var i = 1; i < rowLabels.length; i += 2) {
			//Row number and font size are in rowLabels[i]
			var rowSettings = rowLabels[i];
			var rowNumber = parseInt(rowSettings.split(":")[0], 10);
			var rowSize = parseFloat(rowSettings.split(":")[1], 10);
			//The labels themselves are in rowLabels[i+1]
			band.labels[rowNumber] = rowLabels[i+1].split("|");
			band.customRowFontSizes[rowNumber] = rowSize;
		}
	}

	// Update the inputs with what we have so far
	updateInputs();
	// This will generate a skeleton for the stands and chairs that will be updated below
	readInputs();

	// Stands
	if(band.showStands) {
		var standParts = standMatches[1].split('.');
		var i = 0;
		var standPart = 0;
		var n = parseInt(standParts[0], 36);
		for(var row in band.rows) {
			var val = band.rows[row];
			for(var j = 0; j < val * 2 - 1; j++) {
				var mask = 1 << i;
				band.stands[row][j] = { enabled: (n & mask) != 0, x: 0, y: 0 };
				i++;
				if(i == 31) {
					i = 0;
					standPart++;
					n = parseInt(standParts[standPart], 36);
				}
			}
		}
	}

	// Hidden chairs
	var matches = code.match(/,H([^,]*)/);
	if(matches != null && matches.length > 1) {
		var hidden = matches[1];
		for(var i = 0; i < hidden.length; i += 4) {
			var row   = parseInt(hidden.substring(i  , i+2), 10);
			var chair = parseInt(hidden.substring(i+2, i+4), 10);
			band.chairs[row][chair].enabled = false;
		}
	}

	drawChart();
}

// Scaling up the chart makes printing less blurry but causes more input lag.
// So, use a small canvas normally and switch to the high-quality version before print.
function bindPrintEvents() {
	// Try a couple different ways of listening for the print event
	if('matchMedia' in window) {
		window.matchMedia('print').addListener(function (media) {
			if(media.matches)
				beforePrint();
			else
				afterPrint();
		});
	}
	window.onbeforeprint = beforePrint;
	window.onafterprint = afterPrint;
}

// Scale up canvas before printing to improve quality
function beforePrint() {
	setCanvasScale(4); // If this is changed, the width in the PHP export must also be changed
	drawChart();
}

function afterPrint() {
	setCanvasScale(1);
	drawChart();
}

// Factor by which to scale the canvas from its original size of 1050x510, which
// turned out to be too small and caused charts to be a bit blurry when printed.
function setCanvasScale(scale) {
	canvasScale = scale;
	centerX = 525 * canvasScale;
	centerY = 550 * canvasScale;
	$('canvas').attr('width' , 1050 * scale);
	$('canvas').attr('height',  510 * scale);
	$.jCanvas.defaults.strokeWidth = 2 * canvasScale;
}

function showDebug() {
	if(document.URL.indexOf("debug") > -1) {
		$('#debug').show();
		$('#debug_json').html("Code\n====\n<span style='color: magenta;'>" + htmlEncode(encode(true)) + "</span>\n\nData\n====\n<span style='color: brown;'>" + htmlEncode(JSON.stringify(band, null, 4))) + '</span>';
	}
}

function htmlEncode(str) {
	return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function showHelp(highlight) {
	$('#help').show();
	if(highlight) {
		$('#' + highlight).css('background-color', 'yellow');
	}
	$(document).on('keydown.help', function(e) {
		if(e.which == 27) // ESC
			closeHelp();
	});
}

function closeHelp() {
	$('#help').hide();
	$('#helpstyle *').css('background-color', '');
	$(document).off('keydown.help');
}
