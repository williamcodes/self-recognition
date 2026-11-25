function revealWorkspaceAnswer(guess) {
  const feedback = document.getElementById("feedback");
  const answer = document.getElementById("answer");
  const prefix = guess === undefined ? "" : guess === (answer.dataset.correct || "B") ? "Correct. " : "Different author. ";
  feedback.textContent = prefix + (answer.dataset.feedback || "Astra wrote the operations lead’s decision in workspace B.");
  answer.hidden = false;
  document.getElementById("skip").hidden = true;
  for (const button of document.querySelectorAll("[data-guess]")) button.disabled = true;
  feedback.focus();
}
for (const button of document.querySelectorAll("[data-guess]")) {
  button.addEventListener("click", () => revealWorkspaceAnswer(button.dataset.guess));
}
document.getElementById("skip").addEventListener("click", () => revealWorkspaceAnswer());
