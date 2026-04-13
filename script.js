// DOM Elements
const setup = document.getElementById("setup");
const game = document.getElementById("game");
const petNameInput = document.getElementById("petNameInput");
const goalHours = document.getElementById("goalHours");
const goalMinutes = document.getElementById("goalMinutes");
const petNameDisplay = document.getElementById("petName");
const happinessDisplay = document.getElementById("happiness");
const coinsDisplay = document.getElementById("coins");
const progressDisplay = document.getElementById("progress");
const goalDisplaySpan = document.getElementById("goalDisplay");
const timeLeftSpan = document.getElementById("timeLeft");
const hungerBar = document.getElementById("hungerBar");
const historyList = document.getElementById("history");
const totalStatDiv = document.getElementById("totalStat");
const petImg = document.getElementById("pet");
const messageSpan = document.getElementById("message");
const retryBtn = document.getElementById("retryBtn");
const breakBtn = document.getElementById("breakBtn");

// Core State
let petName = "";
let happiness = 80;
let coins = 0;
let hunger = 0;
let goalHoursTotal = 1;
let goalMinutesTotal = 0;

let feedCountToday = 0;
const MAX_FEEDS_PER_DAY = 5;
let isFullyFed = false;

let studying = false;
let onBreak = false;
let hasStarted = false;
let isDead = false;
let goalReached = false;
let goalAchievedToday = false;

// Timers (seconds precision)
let sessionSeconds = 0;
let totalSeconds = 0;
let breakSeconds = 0;

// Intervals
let studyInterval = null;
let breakInterval = null;
let sleepAnimationInterval = null;
let messageTimeout = null;
let deathAnimationTimeout = null;

// Love Decay System
let idleDecayCounter = 0;
const DECAY_INTERVAL_SEC = 2;

// Total studied seconds for history
let totalStudySecondsAccum = 0;

// Track last time happiness was increased from studying
let lastHappinessIncreaseTime = 0;

// Helper: format HH:MM:SS
function formatTime(seconds) {
  let hours = Math.floor(seconds / 3600);
  let minutes = Math.floor((seconds % 3600) / 60);
  let secs = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Helper: format hours and minutes for display
function formatHoursMinutes(seconds) {
  let hours = Math.floor(seconds / 3600);
  let minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function updateTimersUI() {
  document.getElementById("sessionTimer").innerText = formatTime(sessionSeconds);
  document.getElementById("dailyTimer").innerText = formatTime(totalSeconds);
  document.getElementById("breakTimer").innerText = formatTime(breakSeconds);
}

function updateUI() {
  if (isDead) return;

  happiness = Math.min(100, Math.max(0, happiness));
  hunger = Math.min(100, Math.max(0, hunger));
  coins = Math.max(0, coins);

  happinessDisplay.innerText = Math.floor(happiness);
  coinsDisplay.innerText = coins;
  
  // Display progress in hours with one decimal
  let progressHours = (totalSeconds / 3600).toFixed(1);
  progressDisplay.innerText = progressHours;
  
  hungerBar.style.width = hunger + "%";

  let totalGoalHours = goalHoursTotal + (goalMinutesTotal / 60);
  let remainingHours = Math.max(0, totalGoalHours - (totalSeconds / 3600));
  timeLeftSpan.innerText = remainingHours.toFixed(1);

  // Death check - love AND hunger both at 0
  if (!isDead && happiness === 0 && hunger === 0) {
    triggerDeath();
    return;
  }

  if (!onBreak) {
    if (happiness > 90) petImg.src = "tamagotchiSPRITES/tama_veryhappy.png";
    else if (happiness > 70) petImg.src = "tamagotchiSPRITES/tama_happy.png";
    else if (happiness > 65) petImg.src = "tamagotchiSPRITES/tama_confused.png";
    else if (happiness > 50) petImg.src = "tamagotchiSPRITES/tama_sad1.png";
    else petImg.src = "tamagotchiSPRITES/tama_sad2.png";
  }
}

// Death function with 5 second animation
function triggerDeath() {
  if (isDead) return;
  
  isDead = true;
  
  // Stop all intervals
  if (studyInterval) clearInterval(studyInterval);
  if (breakInterval) clearInterval(breakInterval);
  if (sleepAnimationInterval) clearInterval(sleepAnimationInterval);
  if (globalDecayTimer) clearInterval(globalDecayTimer);
  
  studying = false;
  onBreak = false;
  
  // Show first death sprite
  petImg.src = "tamagotchiSPRITES/tama_dead.png";
  showMessage(petName + " has died...");
  
  // After 5 seconds, switch to second death sprite
  deathAnimationTimeout = setTimeout(() => {
    petImg.src = "tamagotchiSPRITES/tamadead2.png";
    
    // Disable all interactive buttons except retry
    const btns = document.querySelectorAll("#game button");
    btns.forEach(btn => {
      if (btn.id !== "retryBtn") btn.style.display = "none";
    });
    retryBtn.style.display = "inline-block";
  }, 5000);
}

function showMessage(msg) {
  if (messageTimeout) clearTimeout(messageTimeout);
  messageSpan.innerText = msg;
  messageTimeout = setTimeout(() => {
    if (messageSpan) messageSpan.innerText = "";
  }, 2800);
}

function addSessionToHistory(sessionSecondsValue) {
  if (sessionSecondsValue <= 0) return;
  const hours = Math.floor(sessionSecondsValue / 3600);
  const minutes = Math.floor((sessionSecondsValue % 3600) / 60);
  
  let sessionText = "";
  if (hours > 0) {
    sessionText = `Session: ${hours}h ${minutes}m`;
  } else {
    sessionText = `Session: ${minutes}m`;
  }
  
  const listItem = document.createElement("li");
  listItem.innerText = sessionText;
  historyList.prepend(listItem);

  while (historyList.children.length > 12) historyList.removeChild(historyList.lastChild);

  const totalHours = Math.floor(totalStudySecondsAccum / 3600);
  const totalMinutes = Math.floor((totalStudySecondsAccum % 3600) / 60);
  totalStatDiv.innerText = `Total studied today: ${totalHours}h ${totalMinutes}m`;
}

function saveCurrentSession() {
  if (sessionSeconds > 0) {
    totalStudySecondsAccum += sessionSeconds;
    addSessionToHistory(sessionSeconds);
    sessionSeconds = 0;
    updateTimersUI();
  }
}

function feed() {
  if (isDead) {
    showMessage(petName + " is gone...");
    return;
  }
  
  if (isFullyFed) {
    showMessage(petName + " is already full for today! Come back tomorrow for more feeding.");
    return;
  }
  
  if (coins < 5) {
    showMessage("Not enough coins! Study to earn coins (every 15 minutes)");
    return;
  }
  
  feedCountToday++;
  coins -= 5;
  hunger = 100;
  
  if (feedCountToday >= MAX_FEEDS_PER_DAY) {
    isFullyFed = true;
    showMessage(petName + " is now fully fed for the day! Hunger will not decrease. (" + feedCountToday + "/5 feeds)");
  } else {
    let feedsRemaining = MAX_FEEDS_PER_DAY - feedCountToday;
    showMessage(petName + " munches carrots! Hunger fully restored! (" + feedCountToday + "/5 feeds today, " + feedsRemaining + " left)");
  }
  
  updateUI();
}

// Love Decay Watcher
let globalDecayTimer = null;
function startDecayWatcher() {
  if (globalDecayTimer) clearInterval(globalDecayTimer);
  globalDecayTimer = setInterval(() => {
    if (isDead || !hasStarted) return;

    if (goalAchievedToday) {
      happiness = 100;
      updateUI();
      return;
    }

    let eligibleForDecay = false;
    
    // Condition A: idle (not studying AND not on break)
    if (!studying && !onBreak) {
      eligibleForDecay = true;
    }
    
    // Condition B: on break AND break time exceeds total studied time
    if (onBreak && (breakSeconds > totalSeconds)) {
      eligibleForDecay = true;
    }

    if (eligibleForDecay) {
      idleDecayCounter++;
      if (idleDecayCounter >= DECAY_INTERVAL_SEC) {
        happiness = Math.max(0, happiness - 1);
        idleDecayCounter = 0;
        
        // Show loneliness message when happiness < 30
        if (happiness < 30 && happiness > 0) {
          showMessage(petName + " feels lonely... Love -1");
        } else if (happiness % 10 === 0 && happiness < 70 && happiness > 0 && happiness >= 30) {
          showMessage(petName + " is getting sad... Love -1");
        }
        
        updateUI();
      }
    } else {
      idleDecayCounter = 0;
    }
  }, 1000);
}

function startStudy() {
  if (isDead) {
    showMessage("Bunny is no more... please retry.");
    return;
  }
  if (studying) {
    showMessage("Already studying!");
    return;
  }
  if (onBreak) {
    stopBreakInternal();
    showMessage(petName + " wakes up and studies!");
  }
  studying = true;
  onBreak = false;
  
  if (breakInterval) clearInterval(breakInterval);
  if (sleepAnimationInterval) clearInterval(sleepAnimationInterval);

  if (studyInterval) clearInterval(studyInterval);
  studyInterval = setInterval(() => {
    if (!studying || isDead) return;

    sessionSeconds++;
    totalSeconds++;
    
    // Coin reward: every 15 minutes of study (900 seconds)
    if (sessionSeconds % 900 === 0 && sessionSeconds > 0) {
      coins += 5;
      showMessage("+5 Coins! Keep focusing!");
    }
    
    // Happiness increase every 2 minutes (120 seconds) of studying
    if (Math.floor(sessionSeconds / 120) > lastHappinessIncreaseTime) {
      lastHappinessIncreaseTime = Math.floor(sessionSeconds / 120);
      if (!goalAchievedToday && happiness < 100) {
        happiness = Math.min(100, happiness + 2);
        if (happiness < 100) {
          showMessage(petName + " feels happy from studying! Love +2");
        }
      } else if (goalAchievedToday) {
        happiness = 100;
      }
    }
    
    // Hunger decay - only if not fully fed
    if (!isFullyFed) {
      hunger = Math.max(0, hunger - 0.033);
      if (hunger <= 15 && hunger > 0 && Math.floor(hunger) === 14) {
        showMessage("Bunny is getting hungry! Feed soon. (" + feedCountToday + "/5 feeds used)");
      }
    } else {
      hunger = 100;
    }

    // Goal reached detection (in hours)
    let totalGoalHours = goalHoursTotal + (goalMinutesTotal / 60);
    let currentStudyHours = totalSeconds / 3600;
    
    if (!goalReached && !goalAchievedToday && currentStudyHours >= totalGoalHours) {
      goalReached = true;
      goalAchievedToday = true;
      happiness = 100;
      showMessage("GOAL ACHIEVED! " + petName + " is ecstatic! Love will stay at 100 for the rest of the day!");
    }

    updateUI();
    updateTimersUI();
  }, 1000);
}

function pauseStudy() {
  if (isDead) return;
  if (!studying) {
    showMessage("No active session to pause.");
    return;
  }
  studying = false;
  if (studyInterval) clearInterval(studyInterval);
  studyInterval = null;
  showMessage("Paused. Idle decay may start...");
  updateUI();
}

function endStudy() {
  if (isDead) return;
  if (studying) {
    studying = false;
    if (studyInterval) clearInterval(studyInterval);
    studyInterval = null;
  }
  if (sessionSeconds > 0) {
    saveCurrentSession();
    let hours = Math.floor(sessionSeconds / 3600);
    let minutes = Math.floor((sessionSeconds % 3600) / 60);
    showMessage("Session saved! +" + hours + "h " + minutes + "m logged.");
    sessionSeconds = 0;
    lastHappinessIncreaseTime = 0;
    updateTimersUI();
  } else {
    showMessage("No study time recorded.");
  }
  updateUI();
}

function stopBreakInternal() {
  if (breakInterval) clearInterval(breakInterval);
  if (sleepAnimationInterval) clearInterval(sleepAnimationInterval);
  onBreak = false;
  breakBtn.innerText = "Start Break";
  updateUI();
}

function startBreakLogic() {
  if (studying) {
    showMessage("Stop studying first before taking a break!");
    return;
  }
  if (onBreak) return;
  if (isDead) return;

  onBreak = true;
  breakBtn.innerText = "End Break";
  
  if (breakInterval) clearInterval(breakInterval);
  breakInterval = setInterval(() => {
    if (onBreak && !isDead) {
      breakSeconds++;
      updateTimersUI();
    }
  }, 1000);

  let toggleState = false;
  if (sleepAnimationInterval) clearInterval(sleepAnimationInterval);
  sleepAnimationInterval = setInterval(() => {
    if (onBreak && !isDead) {
      petImg.src = toggleState ? "tamagotchiSPRITES/tama_sleep1.png" : "tamagotchiSPRITES/tama_sleep2.png";
      toggleState = !toggleState;
    } else if (!onBreak) {
      clearInterval(sleepAnimationInterval);
    }
  }, 900);
  showMessage(petName + " is sleeping... Zzz");
  updateUI();
}

function stopBreakExternal() {
  if (!onBreak) return;
  if (breakInterval) clearInterval(breakInterval);
  if (sleepAnimationInterval) clearInterval(sleepAnimationInterval);
  onBreak = false;
  breakBtn.innerText = "Start Break";
  updateUI();
  showMessage(petName + " woke up!");
}

function toggleBreak() {
  if (isDead) return;
  if (onBreak) stopBreakExternal();
  else startBreakLogic();
}

function startGame() {
  // Clear any pending death animation timeout
  if (deathAnimationTimeout) clearTimeout(deathAnimationTimeout);
  
  petName = petNameInput.value.trim() || "Buddy";
  goalHoursTotal = parseInt(goalHours.value) || 0;
  goalMinutesTotal = parseInt(goalMinutes.value) || 0;
  
  let totalGoalHours = goalHoursTotal + (goalMinutesTotal / 60);
  if (totalGoalHours <= 0) totalGoalHours = 0.5;

  setup.style.display = "none";
  game.style.display = "flex";

  petNameDisplay.innerText = petName;
  goalDisplaySpan.innerText = totalGoalHours.toFixed(1);
  
  // Reset all state
  totalSeconds = 0;
  sessionSeconds = 0;
  breakSeconds = 0;
  totalStudySecondsAccum = 0;
  happiness = 80;
  coins = 0;
  hunger = 0;
  feedCountToday = 0;
  isFullyFed = false;
  goalReached = false;
  goalAchievedToday = false;
  isDead = false;
  hasStarted = true;
  studying = false;
  onBreak = false;
  idleDecayCounter = 0;
  lastHappinessIncreaseTime = 0;

  // Clear intervals
  if (studyInterval) clearInterval(studyInterval);
  if (breakInterval) clearInterval(breakInterval);
  if (sleepAnimationInterval) clearInterval(sleepAnimationInterval);
  studyInterval = null;
  breakInterval = null;
  sleepAnimationInterval = null;

  updateUI();
  updateTimersUI();
  
  // Clear history
  historyList.innerHTML = "";
  totalStatDiv.innerText = "Total studied today: 0h 0m";
  
  // Re-enable all buttons
  const btns = document.querySelectorAll("#game button");
  btns.forEach(btn => {
    btn.style.display = "inline-block";
  });
  retryBtn.style.display = "none";
  
  showMessage(petName + " is ready! Feed up to 5 times per day. Study to earn coins and increase happiness every 2 minutes!");
  startDecayWatcher();
}

function populateSelectors() {
  for (let i = 0; i <= 12; i++) {
    let optH = new Option(i, i);
    goalHours.add(optH);
  }
  for (let i = 0; i <= 59; i++) {
    let optM = new Option(i, i);
    goalMinutes.add(optM);
  }
  goalHours.value = "1";
  goalMinutes.value = "0";
}

window.onload = () => {
  populateSelectors();
  const preview = document.getElementById("previewPet");
  if (preview) preview.src = "tamagotchiSPRITES/tama_default.png";
};