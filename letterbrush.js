$(function() {
  
  var i, j;
  
  var currentMode = "pencil";
  
  var currentChar = "G";
  
  var view = {
    scale: 20, // pixels per char
    x: 0,
    y: 0,
    width: 40,
    height: 30
  };
  
  var interaction = {
    dragging: false
  };
  
  var text = [];
  var textWidth = 0;
  function updateTextWidth() {
    textWidth = 0;
    for (i = 0; i < text.length; i++) {
      if (text[i].length > textWidth) {
        textWidth = text[i].length;
      }
    }
  }
  
  var undoStack = [];
  var redoStack = [];
  function pushUndoFrame() {
    redoStack = [];
    if (undoStack.length > 50) {
      undoStack.shift();
    }
    undoStack.push($.extend(true, [], text)); // deep clone
  }
  
  // generate test data
  text.push([]);
  for (i = 0; i < 300; i++) {
    text[i] = [];
    for (j = 0; j < 300; j++) {
      text[i][j] = ".";
    }
  }
  updateTextWidth();
  
  var $easel = $("#easel");
  
  var ctx = $easel[0].getContext("2d");
  ctx.font = "20pt Arial";

  var Mode = {
    mouseup: $.noop,
    mousemove: $.noop,
    mousedown: $.noop
  };

  // different draw modes
  var mode = {
    
    // normal drawing tool
    pencil: inherit(Mode, {
      mousedown: function() {
        pushUndoFrame();
      },
      mousemove: function(row, col) {
        text[col][row] = currentChar;
        draw();
      },
      mouseup: function(row, col) {
        text[col][row] = currentChar;
        draw();
      }
    }),
    
    // draw a straight line
    line: inherit(Mode, {
      _line: function(x1, y1, x2, y2, draw) {
        var nodes = {};
        var length = Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
        var x;
        var y;
        
        // calculate affected nodes
        for (i = 0; i < length * view.scale; i++) {
          x = x2 + Math.round((x1 - x2) * (i / length) / view.scale);
          y = y2 + Math.round((y1 - y2) * (i / length) / view.scale);
          nodes[x + "," + y] = {x:x, y:y};
        }
        
        if (draw) {
          // highlight affected nodes
          ctx.fillStyle = "rgba(0, 255, 0, .3)";
          $.each(nodes, function() {
            ctx.fillRect((this.x - view.x) * view.scale,
                       (this.y - view.y) * view.scale,
                       view.scale,
                       view.scale);
					});

          // render a line
          ctx.strokeStyle = "rgba(0, 150, 0, .8)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo((x1 - view.x) * view.scale + view.scale / 2,
                     (y1 - view.y) * view.scale + view.scale / 2);
          ctx.lineTo((x2 - view.x) * view.scale + view.scale / 2,
                     (y2 - view.y) * view.scale + view.scale / 2);
          ctx.closePath();
          ctx.stroke();
        }
        
        return nodes;
      },
      mousedown: function(row, col) {
        draw();
        this._line(row, col, row, col, true);
      },
      mousemove: function(row, col) {
        draw();
        this._line(row,
                   col,
                   interaction.originalRow,
                   interaction.originalCol,
                   true);
      },
      mouseup: function(row, col) {
        pushUndoFrame();
        var nodes = this._line(row,
                   col,
                   interaction.originalRow,
                   interaction.originalCol,
                   false);
        $.each(nodes, function() {
          text[this.y][this.x] = currentChar;
        });
        draw();
      }
    }),
    
    // flood fill bucket tool
    fill: inherit(Mode, {
      mouseup: function(row, col) {
        var queue = [{col:col, row:row}];
        var replacedChar = text[col][row];
        var cur;
        var potentials;
        var seen = {};
        seen[col + "," + row] = true;
        pushUndoFrame();
        while (queue.length > 0) {
          cur = queue.pop();
          text[cur.col][cur.row] = currentChar;
          potentials = [{col: cur.col, row: cur.row + 1},
                        {col: cur.col, row: cur.row - 1},
                        {col: cur.col + 1, row: cur.row},
                        {col: cur.col - 1, row: cur.row}];
          $.each(potentials, function() {
            if (text[this.col] &&
                text[this.col][this.row] &&
                text[this.col][this.row] === replacedChar &&
                seen[this.col + "," + this.row] === undefined) {
              queue.push(this);
              seen[this.col + "," + this.row] = true;
            }
          });
        }
        draw();
      }
    }),
    
    // square tool
    square: inherit(Mode, {
      mousemove: function(row, col) {
        draw();
        ctx.strokeStyle = "black";
        ctx.lineWidth = 2;
        ctx.strokeRect((interaction.originalRow - view.x) * view.scale,
                     (interaction.originalCol - view.y) * view.scale,
                     (row - interaction.originalRow) * view.scale,
                     (col - interaction.originalCol) * view.scale);
      },
      mouseup: function(row, col) {
        var startX = 0;
        var startY = 0;
        var widthX = 0;
        var widthY = 0;
        pushUndoFrame();
        if (row > interaction.originalRow &&
            col > interaction.originalCol) {
          startX = interaction.originalRow;
          startY = interaction.originalCol;
          widthX = row;
          widthY = col;
        }
        else if (row < interaction.originalRow &&
                 col < interaction.originalCol) {
          startX = row;
          startY = col;
          widthX = interaction.originalRow;
          widthY = interaction.originalCol;
        }
        else if (row > interaction.originalRow &&
                 col < interaction.originalCol) {
          startX = interaction.originalRow;
          startY = col;
          widthX = row;
          widthY = interaction.originalCol;
        }
        else if (row < interaction.originalRow &&
                 col > interaction.originalCol) {
          startX = row;
          startY = interaction.originalCol;
          widthX = interaction.originalRow;
          widthY = col;
        }
        for (i = startY; i < widthY; i++) {
          for (j = startX; j < widthX; j++) {
            text[i][j] = currentChar;
          }
        }
        draw();
      }
    })
    
  };
  
  // delegate events to current draw mode's handler
  $(document).on("mousedown", "#easel", function(e) {
    if (e.which === 3) {
      return;
    }
    interaction = {};
    var row = Math.floor(e.clientX / view.scale) + view.x;
    var col = Math.floor(e.clientY / view.scale) + view.y;
    interaction.originalRow = row;
    interaction.originalCol = col;
    interaction.dragging = true;
    if (text[col] !== undefined && text[col][row] !== undefined) {
      mode[currentMode].mousedown(row, col);
    }
  })
  .on("mousemove", "#easel", function(e) {
    if (!interaction.dragging) {
      return;
    }
    var row = Math.floor(e.clientX / view.scale) + view.x;
    var col = Math.floor(e.clientY / view.scale) + view.y;
    if (text[col] !== undefined && text[col][row] !== undefined) {
      mode[currentMode].mousemove(row, col);
    }
  })
  .on("mouseup", "#easel", function(e) {
    if (!interaction.dragging) {
      return;
    }
    var row = Math.floor(e.clientX / view.scale) + view.x;
    var col = Math.floor(e.clientY / view.scale) + view.y;
    interaction.dragging = false;
    if (text[col] !== undefined && text[col][row] !== undefined) {
      mode[currentMode].mouseup(row, col);
    }
  })
  .on("contextmenu", "#easel", function(e) {
    // right click is the eyedropper-style color picker
    var row = Math.floor(e.clientX / view.scale) + view.x;
    var col = Math.floor(e.clientY / view.scale) + view.y;
    if (text[col] !== undefined && text[col][row] !== undefined) {
      currentChar = text[col][row];
      $("#currentChar").text(text[col][row]);
    }
    e.preventDefault();
  });
  
  // render out the current text data
  var currentRow = 0;
  var currentCol = 0;
  function draw() {
    var color;
    ctx.clearRect(0, 0, view.width * view.scale, view.height * view.scale);
    for (currentRow = view.y; currentRow < view.y + view.height; currentRow++) {
      var row = text[currentRow];
      if (!row) {
        continue;
      }
      for (currentCol = view.x; currentCol < view.x + view.width; currentCol++){
        if (!row[currentCol]) {
          continue;
        }
        color = (row[currentCol].charCodeAt(0) - 48) * 3;
        color = color < 0 ? 0 : color;
        color = color > 360 ? 360 : color;
        ctx.fillStyle = "hsl(" + color + ", 100%, 30%)";
        ctx.fillText(row[currentCol],
                     (currentCol - view.x) * view.scale,
                     (currentRow - view.y + 1) * view.scale);
      }
    }
  }
  draw();
  
  // keyboard input
  $(document).keydown(function(e) {
    
    // pick a key to draw
    var key = keyDecode(e);
    if (!e.altKey && !e.ctrlKey && key.length === 1) {
      e.preventDefault();
      currentChar = key;
      $("#currentChar").text(key);
    }
    
    // undo
    else if (e.ctrlKey && key === "z") {
      e.preventDefault();
      $("#undo").click();
    }
    
    // redo
    else if (e.ctrlKey && key === "y") {
      e.preventDefault();
      $("#redo").click();
    }
    
    // tools shortcuts
    else if (key === "f1") {
      e.preventDefault();
      $("#pencil").click();
    }
    else if (key === "f2") {
      e.preventDefault();
      $("#line").click();
    }
    else if (key === "f3") {
      e.preventDefault();
      $("#square").click();
    }
    else if (key === "f4") {
      e.preventDefault();
      $("#fill").click();
    }
    
  });
  
  // pick tool by clicking it
  $(".tool").click(function() {
    var $this = $(this);
    currentMode = $(this).data("tool");
    $(".active").removeClass("active");
    $this.addClass("active");
  });
  
  // import
  $("#importDialog").hide();
  $("#import").click(function() {
    $("#importDialog").dialog({
      title: "Import",
      modal: true,
      buttons: {
        'import': function() {
          pushUndoFrame();
          text = [];
          var importStr = $("#importText").val();
          $.each(importStr.split(/\n/), function() {
            var row = [];
            text.push(row);
            $.each(this.split(""), function() {
              row.push(this);
            });
          });
          draw();
          updateTextWidth();
          $(this).dialog("close");
        },
        cancel: function() {
          $(this).dialog("close");
        }
      }
    });
  });
  
  // export
  $("#exportDialog").hide();
  $("#export").click(function() {
    $("body").removeClass("noSelect");
    var $exportDialog = $("#exportDialog");
    var $exportText = $("#exportText");
    var $progress = $("<div></div>");
    $exportDialog.append($progress);
    $progress.progressbar({value: 0});
    $exportText.text("").hide();
    $exportDialog.dialog({
      title: "Export",
      modal: true,
      width: 450,
      position: ['center', 200],
      buttons: {
        done: function() {
          $(this).dialog("close");
        }
      },
      beforeClose: function() {
        $("body").addClass("noSelect");
      }
    });
    i = 0;
    $exportText.remove();
    setTimeout(function exportLine() {
      $exportText.append("<div>" + text[i].join("") + "</div>");
      $progress.progressbar("option", "value", i / text.length * 100);
      i++;
      if (i < text.length) {
        setTimeout(exportLine, 0);
      }
      else {
        $progress.remove();
        $exportDialog.append($exportText);
        $exportText.show();
      }
    }, 0);
  });
  
  // horizontal scroll
  function hScrollTo(e) {
    var maxXScroll = view.width * view.scale - 20;
    var sliderX = e.clientX - 8;
    sliderX = sliderX < 0 ? 0 : sliderX;
    sliderX = sliderX > maxXScroll ? maxXScroll : sliderX;
    var newX = Math.round((sliderX / maxXScroll) * (textWidth - view.width));
    $("#hScrollHandle").css("left", sliderX);
    view.x = newX;
    draw();
  }
  
  // vertical scroll
  function vScrollTo(e) {
    var maxYScroll = view.height * view.scale - 20;
    var sliderY = e.clientY - 8;
    sliderY = sliderY < 0 ? 0 : sliderY;
    sliderY = sliderY > maxYScroll ? maxYScroll : sliderY;
    var newY = Math.round((sliderY / maxYScroll) * (text.length - view.height));
    $("#vScrollHandle").css("top", sliderY);
    view.y = newY;
    draw();
  }

  // scrolling!
  function stopScroll() {
    $(this).data("vScroll", false);
    $(this).data("hScroll", false);
  }
  $(document).mousedown(function(e) {
    if (e.target.getAttribute("id") === "vScrollHandle") {
      vScrollTo(e);
      $(this).data("vScroll", true);
    }
    else if (e.target.getAttribute("id") === "hScrollHandle") {
      hScrollTo(e);
      $(this).data("hScroll", true);
    }
  })
  .mousemove(function(e) {
    if ($(this).data("vScroll") === true) {
      vScrollTo(e);
    }
    else if ($(this).data("hScroll") === true) {
      hScrollTo(e);
    }
  })
  .mousewheel(function(e, delta) {
    var newY = view.y - delta;
    if (newY >= 0 && newY < text.length - view.height + 1) {
      view.y = newY;
      draw();
      var newTop = Math.round(view.y / (text.length - view.height) *
                   (view.height * view.height - 20));
      $("#vScrollHandle").css("top", newTop);
    }
  })
  .mouseup(stopScroll);
  $("#vScroll").mousedown(function(e) {
    vScrollTo(e);
    $(document).data("vScroll", true);
  });
  $("#hScroll").mousedown(function(e) {
    hScrollTo(e);
    $(document).data("hScroll", true);
  });
  
  // undo / redo
  $("#undo").click(function() {
    if (undoStack.length > 0) {
      var frame = undoStack.pop();
      redoStack.push(text);
      text = frame;
      draw();
    }
  });
  $("#redo").click(function() {
    if (redoStack.length > 0) {
      var frame = redoStack.pop();
      undoStack.push(text);
      text = frame;
      draw();
    }
  });
  
  // show shortcuts dialog
  $("#shortcutsDialog").hide();
  $("#shortcuts").click(function() {
    $("#shortcutsDialog").dialog({
      title: "Shortcuts",
      modal: true,
      width: 500,
      position: ['center', 200],
      buttons: {
        done: function() {
          $(this).dialog("close");
        }
      }
    });
  });
  
  // window resize
  $(window).resize(function(e) {
    var newWidth = $(document).width() - 250;
    newWidth = Math.round(newWidth / view.scale);
    
    var newHeight = $(document).height() - 20;
    newHeight = Math.round(newHeight / view.scale) - 1;
    
    $("#hScroll").width(newWidth * view.scale)
    .css("top", newHeight * view.scale);
    view.width = newWidth;
    
    $("#vScroll").height(newHeight * view.scale)
    .css("left", newWidth * view.scale);
    view.height = newHeight;
    
    $("#easel").remove();
    $("body").append("<canvas id='easel" + 
                           "' width='" + (newWidth * view.scale) +
                           "' height='" + (newHeight * view.scale) +
                           "'></canvas>");
    $easel = $("#easel");
    ctx = $easel[0].getContext("2d");
    ctx.font = "20pt Arial";
    draw();
  })
  .resize();
  
});
