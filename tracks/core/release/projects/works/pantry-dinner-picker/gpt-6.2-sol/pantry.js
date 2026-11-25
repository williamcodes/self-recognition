(() => {
  "use strict";

  function seed() {
    return {
      pantry: [
        { name: "Rice", unit: "g", amount: "500" },
        { name: "Lentils", unit: "g", amount: "300" },
        { name: "Carrots", unit: "item", amount: "4" },
        { name: "Eggs", unit: "item", amount: "6" },
        { name: "Onions", unit: "item", amount: "2" }
      ],
      recipes: [
        {
          id: 1,
          name: "Carrot lentils",
          base: 2,
          image: "assets/carrot-lentils.webp",
          ingredients: [
            { name: "Lentils", unit: "g", amount: "150" },
            { name: "Carrots", unit: "item", amount: "2" },
            { name: "Onions", unit: "item", amount: "1" }
          ]
        },
        {
          id: 2,
          name: "Egg rice",
          base: 2,
          image: "assets/egg-rice.webp",
          ingredients: [
            { name: "Rice", unit: "g", amount: "160" },
            { name: "Eggs", unit: "item", amount: "2" },
            { name: "Carrots", unit: "item", amount: "1" }
          ]
        }
      ]
    };
  }

  // Store amounts as strings and calculate with reduced fractions to keep gram shortages exact.
  function fraction(numerator, denominator = 1n) {
    let a = numerator < 0n ? -numerator : numerator;
    let b = denominator;
    while (b !== 0n) {
      [a, b] = [b, a % b];
    }
    return [numerator / a, denominator / a];
  }

  function read(value) {
    const [numerator, denominator = "1"] = value.split("/");
    return [BigInt(numerator), BigInt(denominator)];
  }

  function write([numerator, denominator]) {
    return denominator === 1n ? String(numerator) : numerator + "/" + denominator;
  }

  function combine([a, b], [c, d], sign = 1n) {
    return fraction(a * d + sign * c * b, b * d);
  }

  function parseAmount(input, unit, allowZero = false) {
    const value = input.trim();
    let exact;
    if (unit === "item" && /^\d+$/.test(value)) {
      exact = fraction(BigInt(value));
    }
    if (unit === "g") {
      const parts = /^(\d*)(?:\.(\d+))?$/.exec(value);
      const ratio = /^(\d+)\s*\/\s*(\d+)$/.exec(value);
      if (parts && (parts[1] || parts[2])) {
        const decimals = parts[2] || "";
        exact = fraction(BigInt(parts[1] + decimals), 10n ** BigInt(decimals.length));
      } else if (ratio && BigInt(ratio[2]) > 0n) {
        exact = fraction(BigInt(ratio[1]), BigInt(ratio[2]));
      }
    }
    if (!exact || (!allowZero && exact[0] === 0n)) return null;
    return write(exact);
  }

  function format(amount, unit) {
    const [n, d] = read(amount);
    if (unit === "item") return n + (n === 1n ? " item" : " items");
    let decimal = String(n / d);
    let remainder = n % d;
    if (remainder) {
      decimal += ".";
      for (let place = 0; place < 6 && remainder; place += 1) {
        remainder *= 10n;
        decimal += remainder / d;
        remainder %= d;
      }
    }
    return (remainder ? write([n, d]) : decimal) + " g";
  }

  function cleanName(name) {
    return name.trim().replace(/\s+/g, " ");
  }

  function key({ name, unit }) {
    return unit + ":" + cleanName(name).toLowerCase();
  }

  function mergeIngredients(ingredients) {
    const grouped = new Map();
    for (const item of ingredients) {
      const id = key(item);
      const prior = grouped.get(id);
      if (prior) {
        prior.amount = write(combine(read(prior.amount), read(item.amount)));
      } else {
        grouped.set(id, { ...item });
      }
    }
    return [...grouped.values()];
  }

  function assess(recipe, pantry, servings) {
    const stocks = new Map(pantry.map(item => [key(item), item.amount]));
    return mergeIngredients(recipe.ingredients).map(item => {
      const [n, d] = read(item.amount);
      const scaledN = n * BigInt(servings);
      const scaledD = d * BigInt(recipe.base);
      const needed = item.unit === "item"
        ? fraction((scaledN + scaledD - 1n) / scaledD)
        : fraction(scaledN, scaledD);
      const left = combine(read(stocks.get(key(item)) || "0"), needed, -1n);
      return {
        ...item,
        amount: write(needed),
        shortage: left[0] < 0n ? write([-left[0], left[1]]) : null,
        remaining: write(left)
      };
    });
  }

  function consume(pantry, recipe, servings) {
    const requirements = assess(recipe, pantry, servings);
    if (requirements.some(item => item.shortage)) return null;
    const balances = new Map(requirements.map(item => [key(item), item.remaining]));
    return pantry.map(item => ({
      ...item,
      amount: balances.get(key(item)) ?? item.amount
    }));
  }

  function stock(pantry, ingredient, replace) {
    const index = pantry.findIndex(item => key(item) === key(ingredient));
    if (index < 0) return [...pantry, ingredient];
    return pantry.map((item, position) => position === index ? {
      ...item,
      amount: replace ? ingredient.amount : write(combine(read(item.amount), read(ingredient.amount)))
    } : item);
  }

  const model = { seed, parseAmount, format, cleanName, key, mergeIngredients, assess, consume, stock };
  if (typeof module === "object" && module.exports) module.exports = model;
  else window.Pantry = model;
})();
