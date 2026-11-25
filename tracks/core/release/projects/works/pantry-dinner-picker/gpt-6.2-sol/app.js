(() => {
  "use strict";

  const { seed, parseAmount, format, cleanName, key, mergeIngredients, assess, consume, stock } = window.Pantry;
  const $ = selector => document.querySelector(selector);
  const storageKey = "pantry-table-v1";
  const servingsInput = $("#servings");
  const pantryDialog = $("#pantry-dialog");
  const recipeDialog = $("#recipe-dialog");
  const mealDialog = $("#meal-dialog");

  const iconPaths = {
    bowl: '<path d="M3 12h18a8 8 0 0 1-7 8H10a8 8 0 0 1-7-8Z"/><path d="M9 22h6M9 8c-2-2 2-3 0-5m6 5c-2-2 2-3 0-5"/>',
    pantry: '<path d="M6 7V4h12v3M5 7h14v2l-1 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-8L5 9V7Zm1 7h12m-12 3h12"/>',
    rice: '<path d="M3 13h18a8 8 0 0 1-8 7h-2a8 8 0 0 1-8-7Zm2 0 1-3 3-1 2-3 3 2 3 1 2 4m-9-2h.01m4-1h.01"/>',
    lentils: '<circle cx="8" cy="8" r="3"/><circle cx="16.5" cy="10.5" r="3"/><circle cx="10" cy="17" r="3"/>',
    carrots: '<path d="M15 9c-2-2-5-1-6 1L4 20l10-5c3-1 3-4 1-6Zm1 0 4-4m-4 4V4m0 5h5M9 12l2 2m-4 2 1 1"/>',
    eggs: '<path d="M18 14c0 4-2.5 6-6 6s-6-2-6-6S8.5 4 12 4s6 6 6 10Z"/>',
    onions: '<path d="M12 3v5m-3-4 3 4 3-4m-3 4c-3.3 3-7 4.6-7 8a7 5 0 0 0 14 0c0-3.4-3.7-5-7-8Zm0 0c-1.5 3.5-3 5.4-3 8 0 2 1 4 3 5 2-1 3-3 3-5 0-2.6-1.5-4.5-3-8Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    edit: '<path d="m14 6 4 4m-13 9 4-1L20 7l-4-4L5 14l-1 6 5-2"/>',
    arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    alert: '<path d="M12 8v5m0 3h.01"/><circle cx="12" cy="12" r="9"/>'
  };

  function icon(name) {
    return '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + iconPaths[name] + "</svg>";
  }

  function escape(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function plural(count, singular) {
    return count + " " + singular + (count === 1 ? "" : "s");
  }

  let persistent = true;
  let state = seed();
  let servings = 2;
  let pendingMeal = null;
  let editingIngredient = null;
  let toastTimer;

  function storageUnavailable() {
    persistent = false;
    const notice = $("#storage-notice");
    notice.textContent = "Browser storage is unavailable. Changes will last until you close or reload this page.";
    notice.hidden = false;
  }

  function latestState() {
    if (persistent) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) return JSON.parse(saved);
      } catch {
        storageUnavailable();
      }
    }
    return state;
  }

  function commit(transform) {
    const apply = () => {
      state = latestState();
      const next = transform(state);
      if (!next) {
        render();
        return false;
      }
      if (persistent) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          storageUnavailable();
        }
      }
      state = next;
      render();
      return true;
    };

    if (persistent && navigator.locks) {
      let started = false;
      return navigator.locks.request(storageKey, () => {
        started = true;
        return apply();
      }).catch(error => {
        if (started) throw error;
        return apply();
      });
    }
    return Promise.resolve(apply());
  }

  function announce(message) {
    const toast = $("#message");
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("visible");
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 4800);
  }

  function render() {
    const pantry = state.pantry;
    const stocked = pantry.filter(item => item.amount !== "0").length;
    $("#pantry-count").textContent = plural(stocked, "ingredient") + " in stock";
    $("#pantry-list").innerHTML = pantry.map((item, index) => {
      const name = escape(item.name);
      const kind = item.name.toLowerCase();
      const ingredientIcon = ["rice", "lentils", "carrots", "eggs", "onions"].includes(kind) ? kind : "pantry";
      return '<li><button class="pantry-row" type="button" data-edit="' + index + '" aria-label="Edit ' + name + ', ' + format(item.amount, item.unit) + '">' +
        '<span class="ingredient-icon ' + ingredientIcon + '">' + icon(ingredientIcon) + '</span>' +
        '<span class="ingredient-name">' + name + '</span><span class="quantity">' + format(item.amount, item.unit) + '</span>' +
        '<span class="edit-mark">' + icon("edit") + "</span></button></li>";
    }).join("");
    const ingredientNames = new Set(pantry.map(item => item.name));
    $("#ingredient-names").innerHTML = [...ingredientNames].map(name => '<option value="' + escape(name) + '"></option>').join("");

    const recipes = state.recipes.map(recipe => ({
      recipe,
      requirements: assess(recipe, pantry, servings)
    }));
    const ready = recipes.filter(({ requirements }) => requirements.every(item => !item.shortage)).length;
    $("#recipe-summary").textContent = ready + " of " + recipes.length + " ready for " + plural(servings, "serving");
    $("#recipe-list").innerHTML = recipes.map(({ recipe, requirements }) => recipeCard(recipe, requirements)).join("");
  }

  function recipeCard(recipe, requirements) {
    const missing = requirements.filter(item => item.shortage);
    const ready = missing.length === 0;
    const title = escape(recipe.name);
    const cover = recipe.image
      ? '<img src="' + escape(recipe.image) + '" width="800" height="800" alt="">'
      : '<div class="cover-placeholder">' + icon("bowl") + "</div>";
    const rows = requirements.map(item => {
      const shortage = item.shortage
        ? '<small>Short ' + format(item.shortage, item.unit) + '</small>'
        : "";
      return '<li class="' + (item.shortage ? "short" : "") + '"><span class="ingredient-name">' + escape(item.name) + '</span><span>' +
        format(item.amount, item.unit) + shortage + "</span></li>";
    }).join("");
    return '<article class="recipe-card panel" aria-labelledby="recipe-' + recipe.id + '">' +
      '<div class="recipe-cover">' + cover +
      '<span class="badge ' + (ready ? "ready" : "missing") + '">' + icon(ready ? "check" : "alert") +
      (ready ? "Ready to cook" : missing.length + " short") + "</span></div>" +
      '<div class="recipe-body"><h3 id="recipe-' + recipe.id + '">' + title + "</h3>" +
      '<ul class="requirements" aria-label="Scaled ingredients">' + rows + "</ul>" +
      '<button class="button ' + (ready ? "primary" : "unavailable") + ' cook" type="button" data-cook="' + recipe.id +
      '" aria-label="' + (ready ? "Cook " : "Missing ingredients for ") + title + '"' + (ready ? "" : " disabled") + ">" +
      (ready ? "Cook this meal" + icon("arrow") : "Missing ingredients") + "</button></div></article>";
  }

  function setServings(value) {
    servings = Math.max(1, Math.min(999, value));
    servingsInput.value = servings;
    $("#fewer").disabled = servings === 1;
    $("#more").disabled = servings === 999;
    render();
  }

  function setError(form, message = "") {
    const error = form.querySelector(".form-error");
    error.hidden = !message;
    error.textContent = message;
  }

  function getIngredient(nameInput, amountInput, unitInput, allowZero = false) {
    const name = cleanName(nameInput.value);
    const unit = unitInput.value;
    const amount = parseAmount(amountInput.value, unit, allowZero);
    if (!name) {
      nameInput.focus();
      throw new Error("Enter an ingredient name.");
    }
    if (amount === null) {
      amountInput.focus();
      const range = allowZero ? "zero or more" : "greater than zero";
      throw new Error(unit === "item" ? "Enter a whole number of items, " + range + "." :
        "Enter grams as a number or fraction, " + range + ".");
    }
    return { name, unit, amount };
  }

  function openPantry(item) {
    const form = $("#pantry-form");
    form.reset();
    setError(form);
    editingIngredient = item;
    $("#pantry-dialog-title").textContent = item ? "Edit ingredient" : "Add to your pantry";
    $("#pantry-hint").textContent = item ? "Set the amount you have on hand." :
      "Adding an existing ingredient increases its stock in the selected unit.";
    form.elements.ingredient.value = item?.name || "";
    form.elements.ingredient.readOnly = Boolean(item);
    form.elements.unit.value = item?.unit || "item";
    form.elements.unit.disabled = Boolean(item);
    form.elements.amount.value = item?.amount || "";
    form.querySelector('[type="submit"]').textContent = item ? "Save amount" : "Add to pantry";
    pantryDialog.showModal();
    if (item) form.elements.amount.select();
  }

  const ingredientRow = '<label class="field">Ingredient<input name="ingredient" list="ingredient-names" required maxlength="80" placeholder="e.g. Rice"></label>' +
    '<label class="field">Amount<input name="amount" inputmode="decimal" required maxlength="48" placeholder="0"></label>' +
    '<label class="field">Unit<select name="unit"><option value="item">Items</option><option value="g">Grams</option></select></label>' +
    '<button class="icon-button remove-line" type="button" aria-label="Remove ingredient row">' + icon("close") + "</button>";

  function updateLineControls() {
    const buttons = $("#recipe-ingredients").querySelectorAll(".remove-line");
    buttons.forEach(button => { button.disabled = buttons.length < 2; });
  }

  function addLine(focus) {
    const row = document.createElement("div");
    row.className = "ingredient-form-row";
    row.innerHTML = ingredientRow;
    $("#recipe-ingredients").append(row);
    updateLineControls();
    if (focus) row.querySelector("input").focus();
  }

  function openRecipe() {
    $("#recipe-form").reset();
    setError($("#recipe-form"));
    $("#recipe-ingredients").textContent = "";
    addLine(false);
    recipeDialog.showModal();
  }

  function openMeal(id) {
    const recipe = state.recipes.find(item => item.id === id);
    if (!recipe || assess(recipe, state.pantry, servings).some(item => item.shortage)) return;
    pendingMeal = { id, servings };
    $("#meal-title").textContent = recipe.name;
    $("#meal-description").textContent = "Confirm " + plural(servings, "serving") + " to deduct these ingredients from your pantry.";
    $("#meal-ingredients").innerHTML = assess(recipe, state.pantry, servings).map(item =>
      "<li><span>" + escape(item.name) + "</span><strong>" + format(item.amount, item.unit) + "</strong></li>").join("");
    setError($("#meal-form"));
    mealDialog.showModal();
  }

  function onSubmit(form, submit) {
    const button = form.querySelector('[type="submit"]');
    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (button.disabled) return;
      setError(form);
      button.disabled = true;
      try {
        await submit(form);
      } catch (error) {
        setError(form, error.message);
      } finally {
        button.disabled = false;
      }
    });
  }

  document.querySelectorAll("[data-icon]").forEach(element => { element.innerHTML = icon(element.dataset.icon); });
  document.querySelectorAll("[data-close]").forEach(button => {
    button.addEventListener("click", () => button.closest("dialog").close());
  });

  servingsInput.addEventListener("input", () => {
    if (!/^[0-9]{1,3}$/.test(servingsInput.value) || Number(servingsInput.value) === 0) return;
    setServings(Number(servingsInput.value));
  });
  servingsInput.addEventListener("blur", () => { servingsInput.value = servings; });
  servingsInput.addEventListener("keydown", event => {
    if (event.key === "Enter") servingsInput.blur();
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setServings(servings + (event.key === "ArrowDown" ? -1 : 1));
    }
  });
  $("#fewer").addEventListener("click", () => setServings(servings - 1));
  $("#more").addEventListener("click", () => setServings(servings + 1));

  $("#add-pantry").addEventListener("click", () => openPantry(null));
  $("#pantry-list").addEventListener("click", event => {
    const button = event.target.closest("[data-edit]");
    if (button) openPantry(state.pantry[Number(button.dataset.edit)]);
  });

  $("#add-recipe").addEventListener("click", openRecipe);
  $("#add-line").addEventListener("click", () => addLine(true));
  $("#recipe-ingredients").addEventListener("click", event => {
    const remove = event.target.closest(".remove-line");
    if (remove) {
      const row = remove.closest(".ingredient-form-row");
      const next = row.nextElementSibling || row.previousElementSibling;
      row.remove();
      updateLineControls();
      next.querySelector("input").focus();
    }
  });
  $("#recipe-ingredients").addEventListener("change", event => {
    if (event.target.name !== "ingredient") return;
    const name = cleanName(event.target.value).toLowerCase();
    const units = state.pantry.filter(item => item.name.toLowerCase() === name);
    if (units.length === 1) event.target.closest(".ingredient-form-row").querySelector("select").value = units[0].unit;
  });

  $("#recipe-list").addEventListener("click", event => {
    const button = event.target.closest("[data-cook]");
    if (button) openMeal(Number(button.dataset.cook));
  });

  onSubmit($("#pantry-form"), async form => {
    const editing = Boolean(editingIngredient);
    const ingredient = getIngredient(form.elements.ingredient, form.elements.amount, form.elements.unit, editing);
    await commit(current => ({ ...current, pantry: stock(current.pantry, ingredient, editing) }));
    pantryDialog.close();
    const position = state.pantry.findIndex(item => key(item) === key(ingredient));
    if (editing) $(".pantry-row[data-edit='" + position + "']").focus();
    announce(editing ? "Pantry amount updated." : ingredient.name + " added to your pantry.");
  });

  onSubmit($("#recipe-form"), async form => {
    const name = cleanName(form.elements.title.value);
    if (!name) {
      form.elements.title.focus();
      throw new Error("Enter a recipe name.");
    }
    const base = Number(form.elements.base.value);
    if (!Number.isInteger(base) || base < 1 || base > 999) {
      form.elements.base.focus();
      throw new Error("Enter a whole number of servings from 1 to 999.");
    }
    const ingredients = mergeIngredients([...$("#recipe-ingredients").children].map(row =>
      getIngredient(row.querySelector('[name="ingredient"]'), row.querySelector('[name="amount"]'), row.querySelector("select"))));
    await commit(current => ({
      ...current,
      recipes: [...current.recipes, { id: current.recipes.length + 1, name, base, ingredients }]
    }));
    recipeDialog.close();
    announce(name + " added to your recipes.");
  });

  onSubmit($("#meal-form"), async () => {
    const { id, servings: portions } = pendingMeal;
    const saved = await commit(current => {
      const recipe = current.recipes.find(item => item.id === id);
      if (!recipe) return null;
      const pantry = consume(current.pantry, recipe, portions);
      return pantry && { ...current, pantry };
    });
    if (!saved) throw new Error("Your pantry changed and this meal is now short on ingredients.");
    mealDialog.close();
    const cookButton = $('[data-cook="' + id + '"]');
    (cookButton.disabled ? $("#add-recipe") : cookButton).focus();
    announce("Meal confirmed. Pantry updated.");
  });

  window.addEventListener("storage", event => {
    if (persistent && (event.key === storageKey || event.key === null)) {
      state = seed();
      state = latestState();
      render();
    }
  });
  state = latestState();
  setServings(2);
})();
