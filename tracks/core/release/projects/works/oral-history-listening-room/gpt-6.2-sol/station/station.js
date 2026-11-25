"use strict";

const menu = document.querySelector("#menu");
const topics = document.querySelector("#topics");
const detail = document.querySelector("#detail");
const title = document.querySelector("#interview-title");
const transcript = document.querySelector("#transcript");
const transcriptText = document.querySelector("#transcript-text");
const play = document.querySelector("#play");
const playLabel = document.querySelector("#play-label");
const position = document.querySelector("#position");
const elapsed = document.querySelector("#elapsed");
const duration = document.querySelector("#duration");
const playerStatus = document.querySelector("#player-status");
let player = null;
let previousButton = null;

function clockTime(value) {
  const seconds = Math.floor(value);
  return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
}

function spokenTime(value) {
  const seconds = Math.floor(value);
  const minutes = Math.floor(seconds / 60);
  return (minutes ? minutes + " minute" + (minutes === 1 ? " " : "s ") : "") +
    (seconds % 60) + " seconds";
}

function showTime(current, total) {
  elapsed.textContent = clockTime(current);
  duration.textContent = clockTime(total);
  position.value = Math.min(Math.floor(current), Number(position.max));
  position.setAttribute("aria-valuetext", spokenTime(current) + " of " + spokenTime(total));
}

function showPlaying(playing) {
  play.dataset.playing = String(playing);
  playLabel.textContent = playing ? "Pause" : "Play";
}

function showAudioError() {
  showPlaying(false);
  play.disabled = true;
  position.disabled = true;
  playerStatus.textContent = "Audio unavailable. You can read this interview below.";
}

function makeText(tag, className, content) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = content;
  return element;
}

function openInterview(interview, button) {
  previousButton = button;
  title.textContent = interview.title;
  document.querySelector("#interview-number").textContent = interview.number;
  document.querySelector("#interview-role").textContent = interview.role;
  transcript.open = false;
  transcriptText.textContent = "";
  for (const [speaker, words] of interview.turns) {
    const line = makeText("p", "", "");
    line.append(makeText("strong", "", speaker), document.createTextNode(words));
    transcriptText.append(line);
  }

  showPlaying(false);
  play.disabled = false;
  position.disabled = true;
  position.max = interview.seconds;
  showTime(0, interview.seconds);
  playerStatus.textContent = "";
  menu.hidden = true;
  detail.hidden = false;
  title.focus();

  const audio = new Audio();
  player = audio;
  audio.preload = "metadata";
  const whileSelected = (callback) => () => {
    if (player === audio) callback();
  };

  audio.addEventListener("loadedmetadata", whileSelected(() => {
    position.max = Math.round(audio.duration);
    position.disabled = false;
    showTime(audio.currentTime, Math.round(audio.duration));
  }));
  audio.addEventListener("timeupdate", whileSelected(() => {
    if (Number.isFinite(audio.duration)) showTime(audio.currentTime, Math.round(audio.duration));
  }));
  audio.addEventListener("play", whileSelected(() => {
    showPlaying(true);
    playerStatus.textContent = "";
  }));
  audio.addEventListener("pause", whileSelected(() => showPlaying(false)));
  audio.addEventListener("ended", whileSelected(() => {
    showPlaying(false);
    const total = Math.round(audio.duration);
    showTime(total, total);
    playerStatus.textContent = "Interview finished. If someone is waiting, please free the seat.";
  }));
  audio.addEventListener("error", whileSelected(showAudioError));
  audio.src = "audio/" + interview.number + "-" + interview.slug + ".mp3";
}

for (const interview of interviews) {
  const item = document.createElement("li");
  const button = makeText("button", "topic", "");
  button.type = "button";
  const copy = makeText("span", "topic-copy", "");
  const time = makeText("span", "topic-time", clockTime(interview.seconds));
  time.setAttribute("aria-label", spokenTime(interview.seconds));
  copy.append(makeText("span", "topic-name", interview.title),
    makeText("span", "topic-teaser", interview.teaser), time);
  button.append(makeText("span", "ticket", interview.number), copy);
  button.addEventListener("click", () => openInterview(interview, button));
  item.append(button);
  topics.append(item);
}

play.addEventListener("click", async () => {
  const audio = player;
  if (!audio) return;
  if (!audio.paused) {
    audio.pause();
    return;
  }
  if (audio.ended) audio.currentTime = 0;
  try {
    await audio.play();
  } catch (error) {
    if (player === audio && error.name !== "AbortError") {
      if (audio.error) showAudioError();
      else playerStatus.textContent = "Playback could not start. Try Play again or read the transcript.";
    }
  }
});

position.addEventListener("input", () => {
  if (player && Number.isFinite(player.duration)) {
    player.currentTime = position.value === position.max ? player.duration : Number(position.value);
  }
});

document.querySelector("#back").addEventListener("click", () => {
  const audio = player;
  player = null;
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
  detail.hidden = true;
  menu.hidden = false;
  previousButton.focus();
});
