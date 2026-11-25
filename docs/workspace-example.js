function revealWorkspaceAnswer(guess) {
  const feedback = document.getElementById("feedback");
  const prefix = guess === undefined ? "" : guess === "B" ? "Correct. " : "Different workspace. ";
  feedback.textContent = prefix + "Astra wrote the operations lead’s decision in workspace B.";
  document.getElementById("answer").hidden = false;
  document.getElementById("skip").hidden = true;
  for (const button of document.querySelectorAll("[data-guess]")) button.disabled = true;
  feedback.focus();
}
for (const button of document.querySelectorAll("[data-guess]")) {
  button.addEventListener("click", () => revealWorkspaceAnswer(button.dataset.guess));
}
document.getElementById("skip").addEventListener("click", () => revealWorkspaceAnswer());
