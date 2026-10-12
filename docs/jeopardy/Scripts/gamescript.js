var categories = ['Allgemeinwissen', 'Bindestrich', 'Als', 'Kultur', 'Musik', 'Pfadi'];
var questions = [
  ['This is the shortcut for the move tool.', 
  'This needs to be done before starting the LEGO™ micro-game.', 
  'This is the the default shortcut for the scale tool.', 
  'This is where you interact with the game being built.', 
  'This is the button that allows you to change your camera orientation.'],
  ['This person creates the controls for the player.', 
  'This generation is when home video game systems became popular.', 
  'This person creates character depth and interaction.', 
  "This perspective has you looking through the character's eyes.", 
  'This person creates the visual elements and assets of the game.'],
  ['This is the shortcut for undo.', 
  'This the button to insert a keyframe. ', 
  'This the button to make a symbol.', 
  'This is the shortcut to group things together.', 
  'This is the shortcut for the scale tool.'],
  ['This is what you end a line of code with.', 
  'This is what you need to keep in mind when naming and calling variables.', 
  'This is the way to print to the console in C#.', 
  'This is used to comment a line of code in C#.', 
  'This is the process of finding and fixing errors in your code.'],
  ['This is the symbol for copyright.', 
  'This allows for complete use of the work without any extra steps needed.', 
  'This requires you to share a work with the same licenses attached.', 
  'This prevents you from making changes to the work.', 
  'This prevents you from using the work for profit.'],
  ['This is the tool with a magnetic needle that helps find directions.',
  'This is a shelter commonly made from fabric, poles, and pegs.',
  'This knot is used to join two ropes of similar thickness.',
  'This knot is commonly used to secure a rope to a post and to begin lashings.',
  'This lashing secures two poles together at a right angle.']];
var uploadedPdfs = {};
var uploadedQuestionMedia = {};
var tileSettings = {};
var isJokerQuestion = false;
var isMinigameQuestion = false;
var isDailyDoubleQuestion = false;
var answers = [
  ['What is "W"?', 
  'What is verifying your age?', 
  'What is "T"?', 
  'What is the scene view?', 
  'What is "alt"?'],
  ['Who is the user interface designer?', 
  'What is Generation 2?', 
  'Who is the game writer?', 
  'What is first person perspective?', 
  'Who is the art designer?'],
  ['What is "Ctrl+Z"?', 
  'What is "F6"?', 
  'What is "F8"?', 
  'What is "ctrl+g"?', 
  'What is "V"?'],
  ['What is capitalization?', 
  'What is ";"?', 
  'What is "Console.WriteLine()"?', 
  'What is "//"?', 
  'What is debugging?'],
  ['What is "©"?', 
  'What is public domain?', 
  'What is share-alike?', 
  'What is non-derivative?', 
  'What is non-commercial?'],
  ['What is a compass?',
  'What is a tent?',
  'What is a reef knot?',
  'What is a clove hitch?',
  'What is a square lashing?']];

var url = document.location.href;
var appBasePath = new URL('../', document.location.href).pathname;
function appAssetPath(path) {
  return appBasePath + path;
}
var isDevMode = /\/dev\/?$/.test(document.location.pathname) || /\/dev\/?$/.test(document.location.search);
var query = new URLSearchParams(document.location.search);
var data = {};
query.forEach(function (value, key) { data[key] = value; });
var defaultTeamColors = ['#d94f70', '#1976d2', '#4f8b3d', '#8c5ac7', '#d18421'];
var numTeams = parseInt(data.teams);
if (numTeams > 6){
  numTeams = 6;
}
var teams = new Array();
for (i = 1; i <= numTeams; i++) {
  var teamColor = /^#[0-9a-f]{6}$/i.test(data['color' + i] || '') ? data['color' + i] : defaultTeamColors[(i - 1) % defaultTeamColors.length];
  teams[i] = [data['name' + i] || 'Team ' + i, 0, teamColor];
}
teams = teams.filter(function () { return true });
var currentTeam = 0;
var previousTeam = 0;
var previousCorrectTeam = 0;
var questionAttempts = numTeams;
var questionsLeft = categories.length * questions[0].length;
var isAnsReveal = false;
var isPlaying = true;
var isHint = true;
var isBtns = true;
var currentQuestion;

var maxBet = 0;
var ddCategory;
var ddQuestionID;
var disableQuestionInput = false;
var dailyDoubleTileKeys = [];

var money = '';

var keys = [49];
for (i=0; i<numTeams-1;i++){
  keys[i+1] = keys[i]+1;
}
var teamTracker = [];
for (i=0; i<numTeams;i++){
  teamTracker[i] = i;
}

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min);
}

function currentQuestionKey(category, questionid) {
  return category + ':' + questionid;
}

function storedPdfFilename(type, category, questionid) {
  return 'category-' + (Number(category) + 1) + '-question-' + (Number(questionid) + 1) + '-' + type + '.pdf';
}

function storedMinigameFilename(category, questionid) {
  return 'category-' + (Number(category) + 1) + '-question-' + (Number(questionid) + 1) + '.html';
}

function storedQuestionMediaFilename(type, category, questionid) {
  return 'category-' + (Number(category) + 1) + '-question-' + (Number(questionid) + 1) + '-' + type + (type === 'video' ? '.mp4' : '.mp3');
}

async function loadQuestionMedia() {
  var response = await fetch('/api/question-media');
  if (!response.ok) {
    throw new Error('Question media server responded with ' + response.status);
  }
  var result = await response.json();
  uploadedQuestionMedia = {};
  result.files.forEach(function (filename) {
    var match = /^category-(\d+)-question-(\d+)-(video\.mp4|audio\.mp3)$/.exec(filename);
    if (!match) {
      return;
    }
    var category = parseInt(match[1], 10) - 1;
    var questionid = parseInt(match[2], 10) - 1;
    if (!questions[category] || questions[category][questionid] === undefined) {
      return;
    }
    var key = currentQuestionKey(category, questionid);
    uploadedQuestionMedia[key] = uploadedQuestionMedia[key] || {};
    var type = match[3].startsWith('video') ? 'video' : 'audio';
    uploadedQuestionMedia[key][type] = filename;
  });
}

function updateQuestionMediaNames(category, questionid) {
  var media = uploadedQuestionMedia[currentQuestionKey(category, questionid)] || {};
  document.getElementById('question-video-name').textContent = media.video || 'No video uploaded';
  document.getElementById('question-audio-name').textContent = media.audio || 'No audio uploaded';
}

function clearQuestionMediaPlayback() {
  var playback = document.getElementById('question-media-playback');
  playback.replaceChildren();
  playback.classList.add('d-none');
}

function renderQuestionMedia(category, questionid) {
  var playback = document.getElementById('question-media-playback');
  var media = uploadedQuestionMedia[currentQuestionKey(category, questionid)] || {};
  var pdf = uploadedPdfs[currentQuestionKey(category, questionid)] || {};
  playback.replaceChildren();
  ['video', 'audio'].forEach(function (type) {
    var filename = media[type];
    if (!filename) {
      return;
    }
    var player = document.createElement(type);
    player.controls = true;
    player.preload = 'metadata';
    player.src = appAssetPath('QuestionMedia/') + encodeURIComponent(filename);
    player.setAttribute('aria-label', type === 'video' ? 'Question video' : 'Question audio');
    if (type === 'video') {
      player.muted = false;
      player.defaultMuted = false;
      player.volume = 1;
    }
    playback.appendChild(player);
    if (type === 'video') {
      var soundControls = document.createElement('div');
      soundControls.className = 'question-video-sound-controls';

      var soundToggle = document.createElement('button');
      soundToggle.type = 'button';
      soundToggle.className = 'question-video-sound-toggle';
      soundToggle.textContent = 'Sound on';
      soundToggle.setAttribute('aria-pressed', 'false');
      soundToggle.addEventListener('click', function () {
        player.muted = !player.muted;
        soundToggle.textContent = player.muted ? 'Sound off' : 'Sound on';
        soundToggle.setAttribute('aria-pressed', player.muted.toString());
      });

      var volumeLabel = document.createElement('label');
      volumeLabel.textContent = 'Volume';
      var volume = document.createElement('input');
      volume.type = 'range';
      volume.min = '0';
      volume.max = '1';
      volume.step = '0.05';
      volume.value = '1';
      volume.setAttribute('aria-label', 'Question video volume');
      volume.addEventListener('input', function () {
        player.volume = Number(volume.value);
        if (player.volume > 0 && player.muted) {
          player.muted = false;
          soundToggle.textContent = 'Sound on';
          soundToggle.setAttribute('aria-pressed', 'false');
        }
      });

      soundControls.appendChild(soundToggle);
      soundControls.appendChild(volumeLabel);
      soundControls.appendChild(volume);
      playback.appendChild(soundControls);
    }
  });
  playback.classList.toggle('d-none', playback.childElementCount === 0);
  if (media.video) {
    document.querySelector('#questionModal .modal-dialog').classList.add('pdf-modal-wide');
  } else if (!pdf.question) {
    document.querySelector('#questionModal .modal-dialog').classList.remove('pdf-modal-wide');
  }
}

function getTileSetting(category, questionid) {
  return tileSettings[currentQuestionKey(category, questionid)] || { type: 'question' };
}

function getWrittenPrompt(type, category, questionid) {
  var setting = getTileSetting(category, questionid);
  var override = type === 'question' ? setting.questionText : setting.answerText;
  if (typeof override === 'string') {
    return override;
  }
  return type === 'question' ? questions[category][questionid] : answers[category][questionid];
}

function assignRandomDailyDoubleTiles() {
  var candidates = [];
  for (var category = 0; category < categories.length; category++) {
    for (var questionid = 0; questionid < questions[category].length; questionid++) {
      if (getTileSetting(category, questionid).type === 'question') {
        candidates.push(currentQuestionKey(category, questionid));
      }
    }
  }
  dailyDoubleTileKeys = [];
  var dailyDoubleCount = Math.min(2, candidates.length);
  while (dailyDoubleTileKeys.length < dailyDoubleCount) {
    var selectedIndex = Math.floor(Math.random() * candidates.length);
    dailyDoubleTileKeys.push(candidates.splice(selectedIndex, 1)[0]);
  }
}

async function loadTileSettings() {
  var response;
  try {
    response = await fetch('/api/tile-settings');
  } catch (error) {
    response = null;
  }
  var isServerSettings = response && response.ok;
  if (!isServerSettings) {
    response = await fetch(appAssetPath('Minigames/tile-settings.json'));
  }
  if (!response.ok) {
    throw new Error('Tile settings server responded with ' + response.status);
  }
  tileSettings = await response.json();
  var migratedLegacyDouble = false;
  Object.keys(tileSettings).forEach(function (key) {
    if (tileSettings[key].type === 'dailyDouble') {
      tileSettings[key].type = 'question';
      migratedLegacyDouble = true;
    }
  });
  if (migratedLegacyDouble && isServerSettings) {
    await persistTileSettings();
  }
}

async function persistTileSettings() {
  var response = await fetch('/api/tile-settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tileSettings)
  });
  if (!response.ok) {
    var result = await response.json();
    throw new Error(result.error || 'Server responded with ' + response.status);
  }
  tileSettings = await response.json();
}

async function setTileSetting(category, questionid, setting) {
  var key = currentQuestionKey(category, questionid);
  var previous = tileSettings[key];
  tileSettings[key] = setting;
  try {
    await persistTileSettings();
  } catch (error) {
    if (previous) {
      tileSettings[key] = previous;
    } else {
      delete tileSettings[key];
    }
    throw error;
  }
}

function displayPlainPrompt(text) {
  if (window.cancelPdfPageRender) {
    window.cancelPdfPageRender();
  }
  document.querySelector('#modal-body .card-text').textContent = text;
  document.getElementById('pdf-preview').textContent = '';
  document.getElementById('pdf-preview').classList.add('d-none');
  document.querySelector('#questionModal .modal-dialog').classList.remove('pdf-modal-wide');
  document.querySelector('#modal-body .card-text').classList.remove('d-none');
  clearQuestionMediaPlayback();
}

function renderMinigame(filename) {
  if (window.cancelPdfPageRender) {
    window.cancelPdfPageRender();
  }
  var prompt = document.querySelector('#modal-body .card-text');
  var preview = document.getElementById('pdf-preview');
  clearQuestionMediaPlayback();
  prompt.classList.add('d-none');
  preview.classList.remove('d-none');
  preview.textContent = '';
  document.querySelector('#questionModal .modal-dialog').classList.add('pdf-modal-wide');
  var frame = document.createElement('iframe');
  frame.src = appAssetPath('Minigames/') + encodeURIComponent(filename);
  frame.title = 'Minigame';
  frame.setAttribute('sandbox', 'allow-scripts');
  preview.appendChild(frame);
}

function renderDevTileEditor(category, questionid) {
  var setting = getTileSetting(category, questionid);
  var key = currentQuestionKey(category, questionid);
  document.getElementById('dev-tile-editor').classList.remove('d-none');
  document.querySelectorAll('[data-tile-type]').forEach(function (button) {
    var selected = button.getAttribute('data-tile-type') === setting.type;
    button.setAttribute('aria-pressed', selected.toString());
  });
  document.getElementById('pdf-upload-controls').classList.toggle('d-none', setting.type !== 'question');
  document.getElementById('question-media-upload-controls').classList.toggle('d-none', setting.type !== 'question');
  document.getElementById('written-question-editor').classList.toggle('d-none', setting.type !== 'question');
  document.getElementById('question-media-upload-controls').classList.toggle('d-none', setting.type !== 'question');
  document.getElementById('minigame-upload-controls').classList.toggle('d-none', setting.type !== 'minigame');
  document.getElementById('joker-config').classList.toggle('d-none', setting.type !== 'joker');
  document.getElementById('minigame-file-name').textContent = setting.minigameUploaded ? storedMinigameFilename(category, questionid) : 'No minigame uploaded';
  document.getElementById('joker-bonus').value = setting.jokerBonus || 500;
  document.getElementById('questionModalLabel').textContent = categories[category] + ' for ' + ((parseInt(questionid, 10) + 1) * 200);

  if (setting.type === 'question') {
    document.getElementById('dev-tile-status').textContent = 'Set the question and answer for this tile.';
    document.getElementById('written-question-input').value = getWrittenPrompt('question', category, questionid);
    document.getElementById('written-answer-input').value = getWrittenPrompt('answer', category, questionid);
    updatePdfUploadNames(category, questionid);
    updateQuestionMediaNames(category, questionid);
    renderPrompt('question', category, questionid);
    renderQuestionMedia(category, questionid);
  } else if (setting.type === 'minigame') {
    document.getElementById('dev-tile-status').textContent = 'Upload a standalone HTML minigame for this tile.';
    if (setting.minigameUploaded) {
      renderMinigame(storedMinigameFilename(category, questionid));
    } else {
      displayPlainPrompt('Upload an HTML minigame for this tile.');
    }
  } else if (setting.type === 'joker') {
    document.getElementById('dev-tile-status').textContent = 'The selected team will receive this bonus during play.';
    displayPlainPrompt('Joker bonus: ' + (setting.jokerBonus || 500) + ' points.');
  }
}

function resetActionButtons() {
  document.getElementById('reveal').classList.remove('d-none');
  document.getElementById('incorrect').classList.remove('d-none');
  document.getElementById('correct').classList.remove('d-none');
  document.getElementById('reveal').innerHTML = isHint ? 'Reveal Answer (space)' : 'Reveal Answer';
  document.getElementById('incorrect').innerHTML = isHint ? 'Incorrect (z)' : 'Incorrect';
  document.getElementById('correct').innerHTML = isHint ? 'Correct (c)' : 'Correct';
}

function showMinigameTile(category, questionid, setting) {
  document.getElementById('questionModalLabel').textContent = categories[category] + ' for ' + money;
  if (setting.minigameUploaded) {
    renderMinigame(storedMinigameFilename(category, questionid));
  } else {
    displayPlainPrompt('No minigame uploaded for this tile.');
  }
  isMinigameQuestion = true;
  document.getElementById('reveal').classList.add('d-none');
}

function showJokerTile(category, questionid, setting) {
  var bonus = setting.jokerBonus || 500;
  money = bonus.toString();
  document.getElementById('questionModalLabel').textContent = categories[category] + ' Joker';
  displayPlainPrompt('Select a team to receive ' + bonus + ' bonus points.');
  document.getElementById('team-selector').value = currentTeam;
  document.getElementById('reveal').classList.add('d-none');
  document.getElementById('incorrect').classList.add('d-none');
  document.getElementById('correct').textContent = 'Award Bonus';
  isJokerQuestion = true;
}

function renderPrompt(type, category, questionid) {
  var key = currentQuestionKey(category, questionid);
  var uploaded = uploadedPdfs[key] && uploadedPdfs[key][type];
  var prompt = document.querySelector('#modal-body .card-text');
  var preview = document.getElementById('pdf-preview');
  var modalDialog = document.querySelector('#questionModal .modal-dialog');
  var fallback = getWrittenPrompt(type, category, questionid);

  if (window.cancelPdfPageRender) {
    window.cancelPdfPageRender();
  }
  prompt.textContent = fallback;
  preview.textContent = '';
  if (type !== 'question') {
    document.getElementById('question-media-playback').classList.add('d-none');
    document.getElementById('question-media-playback').replaceChildren();
  }
  if (uploaded) {
    modalDialog.classList.add('pdf-modal-wide');
    prompt.classList.add('d-none');
    preview.classList.remove('d-none');
    if (window.renderPdfPageAsImage) {
      window.renderPdfPageAsImage(uploaded.url, preview).catch(function (error) {
        console.error('Could not render PDF page as an image:', error);
        preview.textContent = 'Could not render this PDF';
      });
    } else {
      preview.textContent = 'PDF image renderer is unavailable';
    }
  } else {
    modalDialog.classList.remove('pdf-modal-wide');
    prompt.classList.remove('d-none');
    preview.classList.add('d-none');
  }
}

function setUploadedPdf(type, category, questionid, filename, updateName) {
  var key = currentQuestionKey(category, questionid);
  if (!uploadedPdfs[key]) {
    uploadedPdfs[key] = {};
  }
  if (filename) {
    uploadedPdfs[key][type] = {
      url: appAssetPath('Pdf/') + encodeURIComponent(filename),
      name: filename
    };
  } else {
    delete uploadedPdfs[key][type];
  }
  if (updateName !== false) {
    document.getElementById(type + '-pdf-name').textContent = filename ? filename : 'Using typed ' + type;
  }
}

function updatePdfUploadNames(category, questionid) {
  var key = currentQuestionKey(category, questionid);
  ['question', 'answer'].forEach(function (type) {
    var uploaded = uploadedPdfs[key] && uploadedPdfs[key][type];
    document.getElementById(type + '-pdf-name').textContent = uploaded ? uploaded.name : 'Using typed ' + type;
  });
}

async function loadStoredPdfs() {
  var response = await fetch('/api/pdfs');
  if (!response.ok) {
    throw new Error('PDF server responded with ' + response.status);
  }
  var result = await response.json();
  uploadedPdfs = {};
  result.files.forEach(function (filename) {
    var match = /^category-(\d+)-question-(\d+)-(question|answer)\.pdf$/.exec(filename);
    if (!match) {
      return;
    }
    var category = parseInt(match[1], 10) - 1;
    var questionid = parseInt(match[2], 10) - 1;
    if (questions[category] && questions[category][questionid] !== undefined) {
      setUploadedPdf(match[3], category, questionid, filename, false);
    }
  });
  return result.files.length;
}

function showPdfUploadControls() {
  if (isDevMode) {
    document.getElementById('pdf-upload-controls').classList.remove('d-none');
  }
}

function setupBoard() {
  for (var i = 0; i < categories.length; i++) {
    var col = document.createElement('div');
    col.className = 'col-sm text-center';
    var card = document.createElement('div');
    card.className = 'card';

    var cardHeader = document.createElement('div');
    cardHeader.className = 'card-header';
    var header = document.createElement('h2');
    var headerText = document.createTextNode(categories[i]);
    header.appendChild(headerText);

    var list = document.createElement('ul');
    list.className = 'list-group list-group-flush';
    for (var j = 0; j < questions[i].length; j++) {
      var link = document.createElement('a');
      link.setAttribute('href', '');
      link.setAttribute('data-toggle', 'modal');
      link.setAttribute('data-target', '#questionModal');
      link.setAttribute('data-category', i.toString())
      link.setAttribute('data-money', ((j + 1) * 200).toString());
      link.setAttribute('data-questionid', j.toString());
      var listItem = document.createElement('li');
      listItem.className = 'list-group-item';
      var amount = document.createTextNode(((j + 1) * 200).toString());
      listItem.appendChild(amount);

      list.append(link);
      link.append(listItem);
    }

    $('#gameBoard').append(col);
    col.append(card);
    card.append(cardHeader);
    cardHeader.append(header);
    card.append(list);
  }
}

function markCurrentQuestionAwarded(teamIndex) {
  var tile = currentQuestion && currentQuestion.children('li')[0];
  if (!tile) {
    return;
  }
  tile.classList.add('answered-correct');
  tile.style.setProperty('--tile-team-color', teams[teamIndex][2]);
  tile.setAttribute('data-awarded-by', teams[teamIndex][0]);
}

function setupScoreBoard() {
  $('#scoreboard-header').empty();
  $('#scoreboard-data').empty();
  for (var i = 1; i <= numTeams; i++) {
    var h = '<th>' + teams[i - 1][0] + '</th>';
    if (i == 1) {
      var d = '<td class="s-table-text-active" id="t' + i + '">0</td>';
    } else {
      var d = '<td id="t' + i + '">0</td>';
    }
    $('#scoreboard-header').append(h);
    $('#scoreboard-data').append(d);
  }
}

function incrementTeam() {
  if (currentTeam < teams.length - 1) {
    currentTeam++;
  } else {
    currentTeam = 0;
  }
}

function reduceQuestions() {
  questionsLeft--;
}

function buttonSound() {
  var audio = new Audio('../Media/buttonpress.mp3');
  audio.play();
}

function checkForWinner() { 
  if (questionsLeft == 0) {
    var resultUrl = new URL('result.html', document.location.href);
    resultUrl.searchParams.set('teams', numTeams);
    for (i = 0; i < numTeams; i++) {
      resultUrl.searchParams.set('team' + (i + 1), teams[i][1]);
      resultUrl.searchParams.set('name' + (i + 1), teams[i][0]);
    }
    document.location.href = resultUrl.href;
  }
}

function whosTurnIsIt() {
  $('#teamTurn').text(teams[currentTeam][0] + ' is up');
}

function updateScoreboard(teamIndex) {
  $('#t' + (teamIndex + 1)).text(teams[teamIndex][1].toString());
}

function updateActiveTeam() {
  var activeTeam = document.querySelector('.s-table-text-active');
  if (activeTeam) {
    activeTeam.classList.remove('s-table-text-active');
  }
  document.getElementById("t" + (currentTeam + 1)).classList.add('s-table-text-active');
}

function controlAudio(b) {
  document.getElementById('background_audio').muted = b;
}

function nextQuestion() {
  reduceQuestions();
  $('#questionModal').modal('hide');
  currentQuestion.addClass('isDisabled');
  currentQuestion.children().addClass('disabled');
  document.getElementById("incorrect").removeAttribute("data-dismiss")
  isAnsReveal = false;
  isJokerQuestion = false;
  isMinigameQuestion = false;
  isDailyDoubleQuestion = false;
  incrementTeam();
  whosTurnIsIt();
  updateActiveTeam();
  checkForWinner();
}

function hintCheck() {
  if (questionsLeft == (parseInt(categories.length * questions[0].length) - 5)) {
    document.getElementById("reveal").innerHTML = "Reveal Answer";
    document.getElementById("incorrect").innerHTML = "Incorrect";
    document.getElementById("correct").innerHTML = "Correct";
    isHint = false;
  }
}

function hideButtons(){
  var btns = ["reveal", "correct", "incorrect"];
  for (i = 0; i < btns.length; i++) {
      document.getElementById(btns[i]).classList.add("hidden");
      document.getElementById(btns[i]).style.height = "0%";
      document.getElementById(btns[i]).innerHTML = "";
    }
    document.getElementById("modal-footer").classList.remove("modal-footer");
    document.getElementById("toggleBtns").innerHTML = "Turn on Buttons";
}

function showButtons(){
  var btns = ["reveal", "correct", "incorrect"];
  for (i = 0; i < btns.length; i++) {
      document.getElementById(btns[i]).classList.remove("hidden");
      document.getElementById(btns[i]).style.height = "100%";
    }
    if (isAnsReveal == false) {
      if (isHint) {
        document.getElementById("reveal").innerHTML = "Reveal Answer (space)";
      } else {
        document.getElementById("reveal").innerHTML = "Reveal Answer";
      }
    }
    if (isHint) {
      document.getElementById("correct").innerHTML = "Correct (c)";
      document.getElementById("incorrect").innerHTML = "Incorrect (z)";
    }else{
      document.getElementById("correct").innerHTML = "Correct";
      document.getElementById("incorrect").innerHTML = "Incorrect";
    }
    document.getElementById("modal-footer").classList.add("modal-footer");
    document.getElementById("toggleBtns").innerHTML = "Turn off Buttons";
}

function dailyDouble(category, questionid){

  var modal = $("#questionModal")
  clearQuestionMediaPlayback();
  document.getElementById("daily-double").innerHTML = '<p class="card-text"></p>';
  document.querySelector('#questionModal .modal-dialog').classList.remove('pdf-modal-wide');
  modal.find('.modal-title').text("Daily Double!");
  modal.find('.modal-body p').text("Place your bets!");
  document.getElementById('pdf-upload-controls').classList.add('d-none');
  document.getElementById('pdf-preview').classList.add('d-none');

  var bet = document.createElement("input");
  bet.setAttribute("type", "number");
  bet.setAttribute("name", "bet");
  bet.setAttribute("min", "5");
  bet.setAttribute("step", "1");
  bet.setAttribute("pattern", "\d*");
  bet.setAttribute("placeholder", "Enter Bet");
  bet.setAttribute("id", "bet-input");
  bet.classList.add("bet-input");

  var ptext = document.createElement("p");
  maxBet = teams[currentTeam][1];
  if (maxBet <= 5){
    maxBet = 500;
  }
  ptext.innerHTML = "Minimum is 5, maximum is " + maxBet + ".";
  ptext.classList.add("modal-dd-text");

  var ddbtn = document.createElement("button");
  ddbtn.innerHTML = "Confirm";
  ddbtn.classList.add("ddbtn");
  ddbtn.setAttribute("id","ddbtn");
  ddbtn.setAttribute("onClick", "ddbtn()")

  document.getElementById("daily-double").appendChild(ptext);
  document.getElementById("daily-double").appendChild(bet);
  document.getElementById("daily-double").appendChild(document.createElement("br"));
  document.getElementById("daily-double").appendChild(ddbtn);

  if (isBtns){
    hideButtons();
  }
  
  hideTeamSelector();
  
  var audio = new Audio('../Media/dd.mp3');
  audio.play();

  ddCategory = category;
  ddQuestionID = questionid;

  document.getElementById("bet-input").addEventListener('keydown', function (event) {
    if (event.keyCode == 13) { // enter key
      event.preventDefault();
      document.getElementById("ddbtn").click();
    }
  });

  teamTracker = [currentTeam];

  disableQuestionInput = true;
}

function setInputFilter(textbox, inputFilter) {
  ["input", "keydown", "keyup", "mousedown", "mouseup", "select", "contextmenu", "drop"].forEach(function(event) {
    textbox.addEventListener(event, function() {
      if (inputFilter(this.value)) {
        this.oldValue = this.value;
        this.oldSelectionStart = this.selectionStart;
        this.oldSelectionEnd = this.selectionEnd;
      } else if (this.hasOwnProperty("oldValue")) {
        this.value = this.oldValue;
        this.setSelectionRange(this.oldSelectionStart, this.oldSelectionEnd);
      } else {
        this.value = "";
      }
    });
  });
}

function ddbtn(){
  var input = document.getElementById("bet-input").value;
  input = input.split(".")[0];
  if (!input.includes("-") && input >= 5 && input <= maxBet){
    if (isBtns){
      showButtons();
    }
    money = input;

    rebuildTeamSelector();
    for (i=0; i<numTeams; i++){
      if (i!=currentTeam){
        var teamAttempted = document.getElementById("option"+i);
        teamAttempted.parentNode.removeChild(teamAttempted);
      }
    }
    

    var modal = document.getElementById('questionModal');
    document.getElementById('questionModalLabel').innerHTML = (categories[ddCategory] + ' for ' + money);
    showPdfUploadControls();
    renderPrompt('question', ddCategory, ddQuestionID);
    document.getElementById("bet-input").removeEventListener('keydown', function (event) {
      if (event.keyCode == 13) { // enter key
        event.preventDefault();
        document.getElementById("ddbtn").click();
      }
    });
    disableQuestionInput = false;
    var ddOptions = document.getElementById("daily-double");
    ddOptions.innerHTML = '<p class="card-text"></p>';
    document.getElementById("questionModal").focus();
  }
}

function setupTeamSelector(){
  var container = document.getElementById("modal-team-selector");
  var teamSelector = document.getElementById("team-selector");
  if (!teamSelector) {
    rebuildTeamSelector();
    return;
  }
  var options = '';
  for (i = 0; i < numTeams; i++){
    options += '<option value="'+i+'" id="option'+i+'">Team '+(i+1)+'</option>';
  }
  teamSelector.innerHTML = options;
  teamSelector.value = currentTeam.toString();
  container.classList.remove("hidden");
  container.removeAttribute("style");
}

function hideTeamSelector(){
  document.getElementById("modal-team-selector").classList.add("hidden");
  document.getElementById("modal-team-selector").style.height = "0%";
}

function rebuildTeamSelector(){
  var lbl = document.createElement("label");
  lbl.setAttribute("for", "teams");
  lbl.innerHTML = "Buzzed In:";
  
  var slct = document.createElement("select");
  slct.setAttribute("name", "teams");
  slct.setAttribute("id", "team-selector");
  var options = '';
  for (i = 0; i < numTeams; i++){
    options += '<option value="'+i+'" id="option'+i+'">Team '+(i+1)+'</option>';
  }
  slct.innerHTML = options;
  slct.value = currentTeam.toString();
  
  var teamSelector = document.getElementById("modal-team-selector");
  teamSelector.innerHTML = '';
  teamSelector.appendChild(lbl);
  teamSelector.appendChild(slct);
  teamSelector.classList.remove("hidden");
  teamSelector.removeAttribute("style");
  teamSelector.style.paddingRight = "10px"
}

function resetTeamTracker(){
  for (i=0; i<numTeams;i++){
    teamTracker[i] = i;
  }
}

$(document).ready(function () {
  var category = '';
  var questionid = '';

  setupBoard();
  setupScoreBoard();
  setupTeamSelector();
  whosTurnIsIt();

  var pdfLoadPromise = loadStoredPdfs().catch(function () {
    if (isDevMode) {
      document.getElementById('pdf-folder-status').textContent = 'Run node server.js and open the localhost game link to save PDFs';
    }
  });
  var tileSettingsPromise = loadTileSettings().then(function () {
    if (!isDevMode) {
      assignRandomDailyDoubleTiles();
    }
  }).catch(function () {
    if (isDevMode) {
      document.getElementById('dev-tile-status').textContent = 'Could not load saved tile types';
    } else {
      assignRandomDailyDoubleTiles();
    }
  });
  var questionMediaPromise = loadQuestionMedia().catch(function (error) {
    if (isDevMode) {
      document.getElementById('dev-tile-status').textContent = 'Could not load question media: ' + error.message;
    }
  });


  $('a').click(function () {
    currentQuestion = $(this);
    hintCheck();
    questionAttempts = numTeams;
    setupTeamSelector();
    resetTeamTracker();
  });

  $('#questionModal').on('shown.bs.modal', async function (event) {
    var link = $(event.relatedTarget);
    category = link.data('category');
    money = link.data('money');
    questionid = link.data('questionid');
    isAnsReveal = false;
    isJokerQuestion = false;
    isMinigameQuestion = false;
    isDailyDoubleQuestion = false;
    await Promise.all([pdfLoadPromise, tileSettingsPromise, questionMediaPromise]);
    updatePdfUploadNames(category, questionid);
    var modal = $(this);
    resetActionButtons();
    var modalDialog = document.querySelector('#questionModal .modal-dialog');
    var setting = getTileSetting(category, questionid);
    if (isDevMode) {
      modalDialog.classList.add('dev-mode-modal');
      renderDevTileEditor(category, questionid);
      return;
    }

    modalDialog.classList.remove('dev-mode-modal');
    document.getElementById('dev-tile-editor').classList.add('d-none');
    document.getElementById('pdf-upload-controls').classList.add('d-none');
    document.getElementById('question-media-upload-controls').classList.add('d-none');
    if (dailyDoubleTileKeys.indexOf(currentQuestionKey(category, questionid)) !== -1) {
      isDailyDoubleQuestion = true;
      dailyDouble(category, questionid);
    } else if (setting.type === 'minigame') {
      showMinigameTile(category, questionid, setting);
    } else if (setting.type === 'joker') {
      showJokerTile(category, questionid, setting);
    } else {
      modal.find('.modal-title').text(categories[category] + ' for ' + money);
      renderPrompt('question', category, questionid);
      renderQuestionMedia(category, questionid);
    }
  });

  document.getElementById('dev-tile-editor').addEventListener('click', async function (event) {
    var type = event.target.getAttribute('data-tile-type');
    if (!type) {
      return;
    }
    var current = getTileSetting(category, questionid);
    var setting = { type: type };
    if (current.questionText !== undefined) {
      setting.questionText = current.questionText;
    }
    if (current.answerText !== undefined) {
      setting.answerText = current.answerText;
    }
    if (current.jokerBonus !== undefined) {
      setting.jokerBonus = current.jokerBonus;
    }
    if (current.minigameUploaded !== undefined) {
      setting.minigameUploaded = current.minigameUploaded;
    }
    if (type === 'joker') {
      setting.jokerBonus = current.jokerBonus || 500;
    } else if (type === 'minigame') {
      setting.minigameUploaded = current.minigameUploaded === true;
    }
    try {
      await setTileSetting(category, questionid, setting);
      renderDevTileEditor(category, questionid);
      document.getElementById('dev-tile-status').textContent = 'Tile type saved.';
    } catch (error) {
      document.getElementById('dev-tile-status').textContent = 'Could not save tile type: ' + error.message;
    }
  });

  document.getElementById('save-written-question').addEventListener('click', async function () {
    var current = getTileSetting(category, questionid);
    var setting = Object.assign({}, current, {
      type: 'question',
      questionText: document.getElementById('written-question-input').value,
      answerText: document.getElementById('written-answer-input').value
    });
    try {
      await setTileSetting(category, questionid, setting);
      renderDevTileEditor(category, questionid);
      document.getElementById('dev-tile-status').textContent = 'Written question and answer saved.';
    } catch (error) {
      document.getElementById('dev-tile-status').textContent = 'Could not save written text: ' + error.message;
    }
  });

  ['video', 'audio'].forEach(function (type) {
    document.getElementById('question-' + type + '-file').addEventListener('change', async function (event) {
      var file = event.target.files[0];
      if (!file) {
        return;
      }
      var extension = type === 'video' ? /\.mp4$/i : /\.mp3$/i;
      var expectedMime = type === 'video' ? 'video/mp4' : 'audio/mpeg';
      if (!extension.test(file.name) && file.type !== expectedMime) {
        event.target.value = '';
        document.getElementById('dev-tile-status').textContent = 'Choose an MP' + (type === 'video' ? '4 video' : '3 audio') + ' file';
        return;
      }
      if (file.size > 100 * 1024 * 1024) {
        event.target.value = '';
        document.getElementById('dev-tile-status').textContent = 'Media files must be 100 MB or smaller';
        return;
      }

      var filename = storedQuestionMediaFilename(type, category, questionid);
      try {
        var response = await fetch('/api/question-media/' + encodeURIComponent(filename), {
          method: 'POST',
          headers: { 'Content-Type': expectedMime },
          body: file
        });
        if (!response.ok) {
          var responseText = await response.text();
          var responseError = '';
          if (responseText) {
            try {
              responseError = JSON.parse(responseText).error || responseText;
            } catch (parseError) {
              responseError = responseText;
            }
          }
          throw new Error(responseError || 'Server responded with ' + response.status);
        }
        var key = currentQuestionKey(category, questionid);
        uploadedQuestionMedia[key] = uploadedQuestionMedia[key] || {};
        uploadedQuestionMedia[key][type] = filename;
        updateQuestionMediaNames(category, questionid);
        renderQuestionMedia(category, questionid);
        document.getElementById('dev-tile-status').textContent = (type === 'video' ? 'MP4 video' : 'MP3 audio') + ' saved.';
      } catch (error) {
        event.target.value = '';
        document.getElementById('dev-tile-status').textContent = 'Could not save ' + type + ': ' + error.message;
      }
    });
  });

  document.getElementById('question-media-upload-controls').addEventListener('click', async function (event) {
    var type = event.target.getAttribute('data-clear-question-media');
    if (!type) {
      return;
    }
    var filename = storedQuestionMediaFilename(type, category, questionid);
    try {
      var response = await fetch('/api/question-media/' + encodeURIComponent(filename), { method: 'DELETE' });
      if (!response.ok && response.status !== 404) {
        var responseText = await response.text();
        throw new Error(responseText || 'Server responded with ' + response.status);
      }
      var key = currentQuestionKey(category, questionid);
      if (uploadedQuestionMedia[key]) {
        delete uploadedQuestionMedia[key][type];
      }
      document.getElementById('question-' + type + '-file').value = '';
      updateQuestionMediaNames(category, questionid);
      renderQuestionMedia(category, questionid);
      document.getElementById('dev-tile-status').textContent = (type === 'video' ? 'MP4 video' : 'MP3 audio') + ' removed.';
    } catch (error) {
      document.getElementById('dev-tile-status').textContent = 'Could not remove ' + type + ': ' + error.message;
    }
  });

  document.getElementById('minigame-file').addEventListener('change', async function (event) {
    var file = event.target.files[0];
    if (!file) {
      return;
    }
    if (!/\.html?$/i.test(file.name)) {
      event.target.value = '';
      document.getElementById('dev-tile-status').textContent = 'Choose an HTML file';
      return;
    }
    var filename = storedMinigameFilename(category, questionid);
    try {
      var response = await fetch('/api/minigames/' + encodeURIComponent(filename), {
        method: 'PUT',
        headers: { 'Content-Type': 'text/html' },
        body: file
      });
      if (!response.ok) {
        var result = await response.json();
        throw new Error(result.error || 'Server responded with ' + response.status);
      }
      var setting = getTileSetting(category, questionid);
      setting.type = 'minigame';
      setting.minigameUploaded = true;
      await setTileSetting(category, questionid, setting);
      renderDevTileEditor(category, questionid);
      document.getElementById('dev-tile-status').textContent = 'Minigame saved.';
    } catch (error) {
      event.target.value = '';
      document.getElementById('dev-tile-status').textContent = 'Could not save minigame: ' + error.message;
    }
  });

  document.getElementById('clear-minigame').addEventListener('click', async function () {
    var filename = storedMinigameFilename(category, questionid);
    try {
      var response = await fetch('/api/minigames/' + encodeURIComponent(filename), { method: 'DELETE' });
      if (!response.ok && response.status !== 404) {
        var result = await response.json();
        throw new Error(result.error || 'Server responded with ' + response.status);
      }
      var setting = getTileSetting(category, questionid);
      setting.type = 'minigame';
      setting.minigameUploaded = false;
      await setTileSetting(category, questionid, setting);
      renderDevTileEditor(category, questionid);
      document.getElementById('dev-tile-status').textContent = 'Minigame removed.';
    } catch (error) {
      document.getElementById('dev-tile-status').textContent = 'Could not remove minigame: ' + error.message;
    }
  });

  document.getElementById('joker-bonus').addEventListener('change', async function (event) {
    var bonus = parseInt(event.target.value, 10);
    if (!Number.isInteger(bonus) || bonus < 1 || bonus > 100000) {
      document.getElementById('dev-tile-status').textContent = 'Enter a bonus from 1 to 100000';
      return;
    }
    var setting = getTileSetting(category, questionid);
    setting.type = 'joker';
    setting.jokerBonus = bonus;
    try {
      await setTileSetting(category, questionid, setting);
      displayPlainPrompt('Joker bonus: ' + bonus + ' points.');
      document.getElementById('dev-tile-status').textContent = 'Joker bonus saved.';
    } catch (error) {
      document.getElementById('dev-tile-status').textContent = 'Could not save Joker bonus: ' + error.message;
    }
  });

  document.getElementById('modal-body').addEventListener('change', function (event) {
    var type = event.target.getAttribute('data-pdf-type');
    if (!type) {
      return;
    }
    var file = event.target.files[0];
    if (file && !/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      event.target.value = '';
      document.getElementById(type + '-pdf-name').textContent = 'Please choose a PDF file';
      return;
    }
    if (!file) {
      return;
    }
    (async function () {
      try {
        var filename = storedPdfFilename(type, category, questionid);
        var response = await fetch('/api/pdfs/' + encodeURIComponent(filename), {
          method: 'POST',
          headers: { 'Content-Type': 'application/pdf' },
          body: file
        });
        if (!response.ok) {
          var responseText = await response.text();
          var responseError = '';
          if (responseText) {
            try {
              responseError = JSON.parse(responseText).error || responseText;
            } catch (parseError) {
              responseError = responseText;
            }
          }
          throw new Error(responseError || 'Server responded with ' + response.status);
        }
        setUploadedPdf(type, category, questionid, filename);
        document.getElementById('pdf-folder-status').textContent = 'Saved to Pdf/' + filename;
        renderPrompt(isAnsReveal ? 'answer' : 'question', category, questionid);
      } catch (error) {
        event.target.value = '';
        document.getElementById('pdf-folder-status').textContent = 'Could not save PDF: ' + error.message;
      }
    })();
  });

  document.getElementById('pdf-upload-controls').addEventListener('click', async function (event) {
    var type = event.target.getAttribute('data-pdf-clear');
    if (!type) {
      return;
    }
    var filename = storedPdfFilename(type, category, questionid);
    try {
      var response = await fetch('/api/pdfs/' + encodeURIComponent(filename), { method: 'DELETE' });
      if (!response.ok && response.status !== 404) {
        var result = await response.json();
        throw new Error(result.error || 'Server responded with ' + response.status);
      }
    } catch (error) {
      document.getElementById('pdf-folder-status').textContent = 'Could not remove saved PDF: ' + error.message;
      return;
    }
    document.getElementById(type + '-pdf').value = '';
    setUploadedPdf(type, category, questionid, null);
    renderPrompt(isAnsReveal ? 'answer' : 'question', category, questionid);
  });

  document.getElementById("questionModal").addEventListener('keydown', function (event) {
    if (isDevMode) {
      return;
    }
    if (event.target.matches('input, select, textarea, button')) {
      return;
    }
    if (!disableQuestionInput){
      if (event.keyCode == 32 && !isMinigameQuestion && !isJokerQuestion) { // spacebar
        event.preventDefault();
        document.getElementById("reveal").click();
      }
      else if (event.keyCode == 90 && !isJokerQuestion) { // z
        event.preventDefault();
        document.getElementById("incorrect").click();
      }
      else if (event.keyCode == 67) { // c
        event.preventDefault();
        document.getElementById("correct").click();
      }
      else if (keys.includes(event.keyCode)) { // 2
        if(teamTracker.indexOf(keys.indexOf(event.keyCode)) > -1){
          event.preventDefault();
          document.getElementById('team-selector').value=keys.indexOf(event.keyCode);
        }
      }
    }
  });

  $('#reveal').click(function () {
    var modal = $(this);
    if (isAnsReveal == false) {
      renderPrompt('answer', category, questionid);
      if (isHint) {
        document.getElementById("reveal").innerHTML = "Reveal Question (space)";
      } else {
        document.getElementById("reveal").innerHTML = "Reveal Question";
      }
      isAnsReveal = true;
      return;
    }
    renderPrompt('question', category, questionid);
    renderQuestionMedia(category, questionid);
    isAnsReveal = false;
    if (isHint) {
      document.getElementById("reveal").innerHTML = "Reveal Answer (space)";
    } else {
      document.getElementById("reveal").innerHTML = "Reveal Answer";
    }
  });

  $('#correct').click(function () {
    var answeringTeam = parseInt(document.getElementById("team-selector").value);
    markCurrentQuestionAwarded(answeringTeam);
    teams[answeringTeam][1] += parseInt(money);
    updateScoreboard(answeringTeam);
    nextQuestion();
  });

  $('#incorrect').click(function () {
    if (isJokerQuestion) {
      return;
    }
    var attemptedTeam = parseInt(document.getElementById("team-selector").value);
    if (isDailyDoubleQuestion) {
      teams[attemptedTeam][1] -= parseInt(money);
      updateScoreboard(attemptedTeam);
    }
    questionAttempts--;
    var teamAttempted = document.getElementById("option" + attemptedTeam);
    teamAttempted.parentNode.removeChild(teamAttempted);

    for( var i = 0; i < teamTracker.length; i++){
      if (teamTracker[i] == teamAttempted.value) { 
        teamTracker.splice(i, 1); 
      }
    }

    if (questionAttempts == 0 || isDailyDoubleQuestion){
      nextQuestion();
    }
  });

  $('#close').click(function () {
    if (isDailyDoubleQuestion && disableQuestionInput) {
      document.getElementById('daily-double').innerHTML = '<p class="card-text"></p>';
      disableQuestionInput = false;
      rebuildTeamSelector();
      if (isBtns) {
        showButtons();
      }
    }
    if (!isDevMode && (questionAttempts != numTeams || isDailyDoubleQuestion)){
      nextQuestion();
    }
  });
});

$('#audioControl').click(function () {
  if (!isPlaying) {
    document.getElementById("audioControl").innerHTML = "Unmute Music";
  } else {
    document.getElementById("audioControl").innerHTML = "Mute Music";
  }
  isPlaying = !isPlaying;
  controlAudio(isPlaying);
})

$('#toggleBtns').click(function () {
  if (isBtns) {
    hideButtons();
    isBtns = false;
  } else {
    showButtons();
    isBtns = true;
  }
})