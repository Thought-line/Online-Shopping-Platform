(() => {
  "use strict";
  const products = Array.isArray(window.STORE_PRODUCTS) ? window.STORE_PRODUCTS : [];
  const CART_KEY = "everyday-market-cart-v1";
  const state = { category: "All", query: "", sort: "featured", cart: loadCart() };
  const $ = (selector) => document.querySelector(selector);
  const productGrid = $("#product-grid");
  const emptyState = $("#empty-state");
  const cartPanel = $("#cart-panel");
  const overlay = $("#cart-overlay");
  const toast = $("#toast");
  let toastTimer;

  function loadCart() {
    try {
      const stored = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      if (!Array.isArray(stored)) return [];
      return stored.filter((line) => products.some((product) => product.id === line.id) && Number.isInteger(line.qty) && line.qty > 0 && line.qty <= 99);
    } catch {
      return [];
    }
  }

  function saveCart() {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
    } catch {
      showToast("Your browser could not save the bag. It may reset when you leave.");
    }
  }

  function money(value) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  function getFilteredProducts() {
    const query = state.query.trim().toLowerCase();
    const filtered = products.filter((product) => {
      const matchesCategory = state.category === "All" || product.category === state.category;
      const searchable = [product.name, product.category, product.description, product.tag].join(" ").toLowerCase();
      return matchesCategory && (!query || searchable.includes(query));
    });
    if (state.sort === "price-asc") filtered.sort((a, b) => a.price - b.price);
    if (state.sort === "price-desc") filtered.sort((a, b) => b.price - a.price);
    if (state.sort === "name") filtered.sort((a, b) => a.name.localeCompare(b.name));
    return filtered;
  }

  function renderProducts() {
    const visible = getFilteredProducts();
    $("#result-count").textContent = visible.length + (visible.length === 1 ? " product" : " products");
    productGrid.innerHTML = visible.map((product) => `
      <article class="product-card">
        <div class="product-image-wrap">
          <img class="product-image" src="${escapeHTML(product.image)}" alt="${escapeHTML(product.alt)}" loading="lazy" width="600" height="690">
          <span class="product-tag">${escapeHTML(product.tag)}</span>
          <button class="quick-add" type="button" data-add="${escapeHTML(product.id)}" aria-label="Add ${escapeHTML(product.name)} to bag">Add to bag +</button>
        </div>
        <div class="product-meta">
          <p class="product-category">${escapeHTML(product.category)}</p>
          <h3 class="product-name">${escapeHTML(product.name)}</h3>
          <p class="product-description">${escapeHTML(product.description)}</p>
          <div class="price-row"><span class="price">${money(product.price)}</span>${product.compareAt ? `<span class="compare-price">${money(product.compareAt)}</span>` : ""}</div>
        </div>
      </article>`).join("");
    emptyState.hidden = visible.length !== 0;
    productGrid.hidden = visible.length === 0;
  }

  function setCategory(category) {
    state.category = category;
    document.querySelectorAll("[data-category]").forEach((button) => {
      const active = button.dataset.category === category;
      if (button.classList.contains("filter-chip")) {
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      }
    });
    renderProducts();
  }

  function addToCart(id) {
    const product = products.find((item) => item.id === id);
    if (!product) return;
    const line = state.cart.find((item) => item.id === id);
    if (line) {
      if (line.qty >= 99) return showToast("Maximum quantity is 99 per product.");
      line.qty += 1;
    } else {
      state.cart.push({ id, qty: 1 });
    }
    saveCart();
    renderCart();
    showToast(product.name + " added to your bag");
  }

  function changeQuantity(id, delta) {
    const line = state.cart.find((item) => item.id === id);
    if (!line) return;
    line.qty += delta;
    if (line.qty <= 0) state.cart = state.cart.filter((item) => item.id !== id);
    if (line.qty > 99) line.qty = 99;
    saveCart();
    renderCart();
  }

  function renderCart() {
    const count = state.cart.reduce((sum, line) => sum + line.qty, 0);
    const subtotal = state.cart.reduce((sum, line) => {
      const product = products.find((item) => item.id === line.id);
      return sum + (product ? product.price * line.qty : 0);
    }, 0);
    $("#cart-count").textContent = count;
    $("#cart-title-count").textContent = "(" + count + ")";
    $("#cart-subtotal").textContent = money(subtotal);
    if (!state.cart.length) {
      $("#cart-items").innerHTML = '<div class="cart-empty"><span>♡</span><h3>Your bag is taking a breather.</h3><p>Have a look around and add something you love.</p></div>';
    } else {
      $("#cart-items").innerHTML = state.cart.map((line) => {
        const product = products.find((item) => item.id === line.id);
        if (!product) return "";
        return `<div class="cart-line">
          <img src="${escapeHTML(product.image)}" alt="" loading="lazy" width="78" height="91">
          <div><p class="cart-line-category">${escapeHTML(product.category)}</p><p class="cart-line-name">${escapeHTML(product.name)}</p><span class="cart-line-price">${money(product.price)}</span>
            <div class="cart-line-controls"><button class="qty-button" data-qty="${escapeHTML(line.id)}" data-delta="-1" aria-label="Decrease quantity of ${escapeHTML(product.name)}" type="button">−</button><span class="qty-value">${line.qty}</span><button class="qty-button" data-qty="${escapeHTML(line.id)}" data-delta="1" aria-label="Increase quantity of ${escapeHTML(product.name)}" type="button">+</button><button class="remove-item" data-remove="${escapeHTML(line.id)}" type="button">Remove</button></div>
          </div>
        </div>`;
      }).join("");
    }
  }

  function openCart() {
    cartPanel.hidden = false;
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    $("#close-cart").focus();
  }

  function closeCart() {
    cartPanel.hidden = true;
    overlay.hidden = true;
    document.body.style.overflow = "";
    $("#open-cart").focus();
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 2500);
  }

  $("#header-search").addEventListener("input", (event) => {
    state.query = event.target.value;
    renderProducts();
    if (state.query.trim()) $("#products").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("#filter-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (button) setCategory(button.dataset.category);
  });
  $("#category-grid").addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    setCategory(button.dataset.category);
    $("#products").scrollIntoView({ behavior: "smooth" });
  });
  $("#sort-select").addEventListener("change", (event) => {
    state.sort = event.target.value;
    renderProducts();
  });
  productGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-add]");
    if (button) addToCart(button.dataset.add);
  });
  $("#clear-filters").addEventListener("click", () => {
    state.query = "";
    state.sort = "featured";
    $("#header-search").value = "";
    $("#sort-select").value = "featured";
    setCategory("All");
  });
  $("#open-cart").addEventListener("click", openCart);
  $("#close-cart").addEventListener("click", closeCart);
  $("#continue-shopping").addEventListener("click", closeCart);
  overlay.addEventListener("click", closeCart);
  $("#cart-items").addEventListener("click", (event) => {
    const quantityButton = event.target.closest("[data-qty]");
    const removeButton = event.target.closest("[data-remove]");
    if (quantityButton) changeQuantity(quantityButton.dataset.qty, Number(quantityButton.dataset.delta));
    if (removeButton) {
      state.cart = state.cart.filter((line) => line.id !== removeButton.dataset.remove);
      saveCart();
      renderCart();
    }
  });
  $("#checkout-button").addEventListener("click", () => {
    showToast("Checkout is not enabled yet. A backend and payment integration are needed.");
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !cartPanel.hidden) closeCart();
  });

  $("#year").textContent = new Date().getFullYear();
  renderProducts();
  renderCart();
})();