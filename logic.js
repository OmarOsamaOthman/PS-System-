const defaultSettings = {
    prices: {
        PS4: { normal: 15, multi: 20 },
        PS5: { normal: 20, multi: 30 }
    }
};

let appSettings = JSON.parse(localStorage.getItem("appSettings")) || defaultSettings;

let devicesList = JSON.parse(localStorage.getItem("devicesList")) || [
    { id: 1, name: "جهاز 1", type: "PS5", session: null },
    { id: 2, name: "جهاز 2", type: "PS5", session: null }
];

let drinksList = JSON.parse(localStorage.getItem("drinksList")) || [
    { id: 1, name: "فيوري", price: 25, stock: 10 },
    { id: 2, name: "بيبسي", price: 15, stock: 8 }
];

let quickDrinksCart = [];

let sessionsHistory = JSON.parse(localStorage.getItem("sessionsHistory")) || [];
let total = Number(localStorage.getItem("total")) || 0;
let pendingPayment = null;
let endedAlerts = JSON.parse(localStorage.getItem("endedAlerts")) || {};

function saveAll() {
    localStorage.setItem("appSettings", JSON.stringify(appSettings));
    localStorage.setItem("devicesList", JSON.stringify(devicesList));
    localStorage.setItem("drinksList", JSON.stringify(drinksList));
    localStorage.setItem("sessionsHistory", JSON.stringify(sessionsHistory));
    localStorage.setItem("total", total);
    localStorage.setItem("endedAlerts", JSON.stringify(endedAlerts));
}

function formatDate(ts) {
    if (!ts) return "-";
    return new Date(ts).toLocaleString("ar-EG");
}

function formatDuration(ms) {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h}س ${m}د ${s}ث`;
}



function getModePrice(deviceType, mode) {
    if (mode === "عادي") return Number(appSettings.prices[deviceType].normal);
    return Number(appSettings.prices[deviceType].multi);
}

function getStatusText(device) {
    if (!device.session) return "متوقف";
    if (device.session.state === "payment_pending") return "بانتظار الدفع";
    if (device.session.isPaused) return "إيقاف مؤقت";
    if (isSessionEnded(device)) return "انتهت المدة";
    return `شغال ${device.session.currentMode}`;
}

function getStatusClass(device) {
    if (!device.session) return "badge-stopped";
    if (device.session.state === "payment_pending") return "badge-payment";
    if (device.session.isPaused) return "badge-paused";
    if (isSessionEnded(device)) return "badge-payment";
    return "badge-running";
}

function renderTotal() {
    document.getElementById("total").innerText = total;
}

function getDurationPresetOptions(selected = "open") {
    return `
    <option value="30" ${selected === "30" ? "selected" : ""}>نصف ساعة</option>
    <option value="60" ${selected === "60" ? "selected" : ""}>ساعة</option>
    <option value="120" ${selected === "120" ? "selected" : ""}>ساعتين</option>
    <option value="open" ${selected === "open" ? "selected" : ""}>مفتوح</option>
  `;
}

function isSessionEnded(device) {
    if (!device.session) return false;
    if (device.session.state !== "running") return false;
    if (device.session.isPaused) return false;
    if (device.session.durationType === "open") return false;

    const limitMs = Number(device.session.durationMinutes) * 60000;
    return calculateSessionTime(device) >= limitMs;
}

function getRemainingTime(device) {
    if (!device.session || device.session.durationType === "open") return null;
    const limitMs = Number(device.session.durationMinutes) * 60000;
    return Math.max(0, limitMs - calculateSessionTime(device));
}

function startSession(deviceId, mode) {
    const device = devicesList.find(d => d.id === deviceId);
    if (!device || device.session) return;

    const select = document.getElementById(`duration-select-${deviceId}`);
    const selectedDuration = select ? select.value : "open";
    const now = Date.now();

    device.session = {
        startedAt: now,
        currentMode: mode,
        currentPrice: getModePrice(device.type, mode),
        currentSegmentStart: now,
        isPaused: false,
        state: "running",
        segments: [],
        drinks: [],
        durationType: selectedDuration === "open" ? "open" : "limited",
        durationMinutes: selectedDuration === "open" ? null : Number(selectedDuration)
    };

    endedAlerts[device.id] = false;

    saveAll();
    renderDevices();
}

function continueSameCustomer(deviceId) {
    const device = devicesList.find(d => d.id === deviceId);
    if (!device || !device.session) return;

    const select = document.getElementById(`duration-select-${deviceId}`);
    const selectedDuration = select ? select.value : "open";

    device.session.startedAt = Date.now();
    device.session.currentSegmentStart = Date.now();
    device.session.isPaused = false;
    device.session.state = "running";
    device.session.segments = [];
    device.session.drinks = [];
    device.session.durationType = selectedDuration === "open" ? "open" : "limited";
    device.session.durationMinutes = selectedDuration === "open" ? null : Number(selectedDuration);

    endedAlerts[device.id] = false;

    saveAll();
    renderDevices();
}

function closeCurrentSegment(device, endTime = Date.now()) {
    if (!device.session) return;
    if (device.session.isPaused) return;
    if (!device.session.currentSegmentStart) return;

    const durationMs = endTime - device.session.currentSegmentStart;
    const cost = Math.ceil((durationMs / 3600000) * device.session.currentPrice);

    device.session.segments.push({
        category: device.session.currentMode,
        start: device.session.currentSegmentStart,
        end: endTime,
        durationMs,
        pricePerHour: device.session.currentPrice,
        cost
    });

    device.session.currentSegmentStart = null;
}

function togglePauseResume(deviceId) {
    const device = devicesList.find(d => d.id === deviceId);
    if (!device || !device.session) return;
    if (device.session.state === "payment_pending") return;
    if (isSessionEnded(device)) return;

    if (device.session.isPaused) {
        device.session.isPaused = false;
        device.session.currentSegmentStart = Date.now();
    } else {
        closeCurrentSegment(device);
        device.session.isPaused = true;
    }

    saveAll();
    renderDevices();
}

function switchMode(deviceId, newMode) {
    const device = devicesList.find(d => d.id === deviceId);
    if (!device || !device.session) return;
    if (device.session.isPaused) return;
    if (device.session.state === "payment_pending") return;
    if (isSessionEnded(device)) return;
    if (device.session.currentMode === newMode) return;

    closeCurrentSegment(device);

    device.session.currentMode = newMode;
    device.session.currentPrice = getModePrice(device.type, newMode);
    device.session.currentSegmentStart = Date.now();

    saveAll();
    renderDevices();
}

function addDrinkToDevice(deviceId) {
    const device = devicesList.find(d => d.id === deviceId);
    if (!device || !device.session) return;
    if (device.session.state === "payment_pending") return;

    const drinkSelect = document.getElementById(`drink-select-${deviceId}`);
    const qtyInput = document.getElementById(`drink-qty-${deviceId}`);
    if (!drinkSelect || !qtyInput) return;

    const drinkId = Number(drinkSelect.value);
    const qty = Number(qtyInput.value) || 1;
    const drink = drinksList.find(d => d.id === drinkId);

    if (!drink || drink.stock <= 0) return;
    if (qty <= 0) return;
    if (qty > drink.stock) {
        alert(`المتاح فقط من ${drink.name}: ${drink.stock}`);
        return;
    }

    drink.stock -= qty;

    device.session.drinks.push({
        category: "مشروب",
        name: drink.name,
        price: Number(drink.price),
        quantity: qty,
        totalPrice: Number(drink.price) * qty,
        addedAt: Date.now()
    });

    saveAll();
    renderDevices();
}

function calculateSessionTime(device) {
    if (!device.session) return 0;

    let totalMs = device.session.segments.reduce((sum, seg) => sum + seg.durationMs, 0);

    if (
        device.session.state === "running" &&
        !device.session.isPaused &&
        device.session.currentSegmentStart
    ) {
        totalMs += Date.now() - device.session.currentSegmentStart;
    }

    return totalMs;
}

function calculateSessionCost(device) {
    if (!device.session) return 0;

    let totalSegments = device.session.segments.reduce((sum, seg) => sum + seg.cost, 0);

    if (
        device.session.state === "running" &&
        !device.session.isPaused &&
        device.session.currentSegmentStart
    ) {
        const durationMs = Date.now() - device.session.currentSegmentStart;
        totalSegments += Math.ceil((durationMs / 3600000) * device.session.currentPrice);
    }

    const drinksTotal = device.session.drinks.reduce((sum, d) => sum + Number(d.totalPrice || d.price), 0);
    return totalSegments + drinksTotal;
}

function stopSession(deviceId) {
    const device = devicesList.find(d => d.id === deviceId);
    if (!device || !device.session) return;
    if (device.session.state === "payment_pending") return;

    const stopTime = Date.now();

    if (!device.session.isPaused) {
        closeCurrentSegment(device, stopTime);
    }

    device.session.state = "payment_pending";

    const segments = device.session.segments.map(seg => ({ ...seg }));
    const drinks = device.session.drinks.map(drink => ({ ...drink }));

    const totalSegmentsCost = segments.reduce((sum, seg) => sum + seg.cost, 0);
    const totalDrinksCost = drinks.reduce((sum, d) => sum + Number(d.totalPrice || d.price), 0);

    pendingPayment = {
        deviceId: device.id,
        deviceName: device.name,
        deviceType: device.type,
        startedAt: device.session.startedAt,
        endedAt: stopTime,
        segments,
        drinks,
        finalTotal: totalSegmentsCost + totalDrinksCost
    };

    saveAll();
    renderDevices();
    openPaymentModal();
}

function openPaymentModal() {
    if (!pendingPayment) return;

    const summary = document.getElementById("sessionSummary");
    const finalAmount = document.getElementById("finalAmount");
    const paidAmount = document.getElementById("paidAmount");
    const changeAmount = document.getElementById("changeAmount");
    const paymentError = document.getElementById("paymentError");

    finalAmount.innerText = pendingPayment.finalTotal;
    paidAmount.value = "";
    changeAmount.innerText = "0";
    paymentError.innerText = "";

    let html = `
    <div class="summary-card">
      <strong>الجهاز:</strong> ${pendingPayment.deviceName} - ${pendingPayment.deviceType}<br>
      <strong>البداية:</strong> ${formatDate(pendingPayment.startedAt)}<br>
      <strong>النهاية:</strong> ${formatDate(pendingPayment.endedAt)}
    </div>
  `;

    pendingPayment.segments.forEach(seg => {
        html += `
      <div class="summary-card">
        <strong>${seg.category}</strong><br>
        من: ${formatDate(seg.start)}<br>
        إلى: ${formatDate(seg.end)}<br>
        المدة: ${formatDuration(seg.durationMs)}<br>
        السعر: ${seg.cost} جنيه<br>
        سعر الساعة: ${seg.pricePerHour} جنيه
      </div>
    `;
    });

    pendingPayment.drinks.forEach(drink => {
        html += `
      <div class="summary-card">
        <strong>مشروب</strong><br>
        الاسم: ${drink.name}<br>
        العدد: ${drink.quantity || 1}<br>
        الوقت: ${formatDate(drink.addedAt)}<br>
        السعر: ${drink.totalPrice || drink.price} جنيه
      </div>
    `;
    });

    if (!pendingPayment.segments.length && !pendingPayment.drinks.length) {
        html += `<div class="summary-card">لا يوجد تفاصيل</div>`;
    }

    summary.innerHTML = html;
    document.getElementById("paymentModal").classList.remove("hidden");
}

function closePaymentModal() {
    if (pendingPayment) {
        const device = devicesList.find(d => d.id === pendingPayment.deviceId);
        if (device && device.session) {
            device.session.state = device.session.isPaused ? "paused" : "running";
        }
    }

    pendingPayment = null;
    saveAll();
    renderDevices();
    document.getElementById("paymentModal").classList.add("hidden");
}

function calculateChange() {
    if (!pendingPayment) return;
    const paid = Number(document.getElementById("paidAmount").value) || 0;
    document.getElementById("changeAmount").innerText = paid - pendingPayment.finalTotal;
}

function confirmPayment() {
    if (!pendingPayment) return;

    const paid = Number(document.getElementById("paidAmount").value) || 0;
    const paymentError = document.getElementById("paymentError");

    if (paid < pendingPayment.finalTotal) {
        paymentError.innerText = "المبلغ المستلم أقل من المطلوب.";
        return;
    }

    paymentError.innerText = "";

    const rows = [];

    pendingPayment.segments.forEach(seg => {
        rows.push({
            deviceName: pendingPayment.deviceName,
            deviceType: pendingPayment.deviceType,
            category: seg.category,
            from: seg.start,
            to: seg.end,
            durationMs: seg.durationMs,
            amount: seg.cost,
            details: `${seg.pricePerHour} جنيه / ساعة`
        });
    });

    pendingPayment.drinks.forEach(drink => {
        rows.push({
            deviceName: pendingPayment.deviceName,
            deviceType: pendingPayment.deviceType,
            category: "مشروب",
            from: drink.addedAt,
            to: drink.addedAt,
            durationMs: 0,
            amount: drink.totalPrice || drink.price,
            details: `${drink.name} × ${drink.quantity || 1}`
        });
    });

    sessionsHistory.unshift(...rows);
    total += pendingPayment.finalTotal;

    const device = devicesList.find(d => d.id === pendingPayment.deviceId);
    if (device) {
        device.session = null;
    }

    endedAlerts[pendingPayment.deviceId] = false;
    pendingPayment = null;

    saveAll();
    renderTotal();
    renderHistory();
    renderDevices();
    document.getElementById("paymentModal").classList.add("hidden");
}

function renderQuickDrinksOptions() {
    const select = document.getElementById("quickDrinkSelect");
    if (!select) return;

    const available = drinksList.filter(d => Number(d.stock) > 0);

    if (!available.length) {
        select.innerHTML = `<option value="">لا يوجد مشروبات متاحة</option>`;
        return;
    }

    select.innerHTML = available.map(drink => `
    <option value="${drink.id}">
      ${drink.name} - ${drink.price} جنيه (متاح: ${drink.stock})
    </option>
  `).join("");
}

function addQuickDrink() {
    const select = document.getElementById("quickDrinkSelect");
    const qtyInput = document.getElementById("quickDrinkQty");

    if (!select || !qtyInput) return;

    const drinkId = Number(select.value);
    const qty = Number(qtyInput.value) || 1;

    const drink = drinksList.find(d => d.id === drinkId);
    if (!drink) return;

    if (qty <= 0) {
        showToast?.("العدد لازم يكون أكبر من صفر", "danger");
        return;
    }

    if (qty > drink.stock) {
        alert(`المتاح فقط من ${drink.name}: ${drink.stock}`);
        return;
    }

    const existing = quickDrinksCart.find(item => item.drinkId === drinkId);

    if (existing) {
        if (existing.quantity + qty > drink.stock) {
            alert(`إجمالي الكمية المطلوبة أكبر من المتاح من ${drink.name}`);
            return;
        }

        existing.quantity += qty;
        existing.totalPrice = existing.quantity * existing.price;
    } else {
        quickDrinksCart.push({
            drinkId: drink.id,
            name: drink.name,
            price: Number(drink.price),
            quantity: qty,
            totalPrice: Number(drink.price) * qty
        });
    }

    qtyInput.value = 1;
    renderQuickDrinksCart();
}


function removeQuickDrink(drinkId) {
    quickDrinksCart = quickDrinksCart.filter(item => item.drinkId !== drinkId);
    renderQuickDrinksCart();
}


function getQuickDrinksTotal() {
    return quickDrinksCart.reduce((sum, item) => sum + item.totalPrice, 0);
}


function renderQuickDrinksCart() {
    const list = document.getElementById("quickDrinksList");
    const totalEl = document.getElementById("quickDrinksTotal");

    if (!list || !totalEl) return;

    if (!quickDrinksCart.length) {
        list.innerHTML = `<p class="meta">لا يوجد طلبات مشروبات حالياً</p>`;
        totalEl.innerText = "0";
        renderQuickDrinksOptions();
        return;
    }

    list.innerHTML = quickDrinksCart.map(item => `
    <div class="quick-item">
      <div>
        <strong>${item.name}</strong>
        <div class="muted">العدد: ${item.quantity} × ${item.price} جنيه</div>
      </div>

      <div class="small-actions">
        <span><strong>${item.totalPrice} جنيه</strong></span>
        <button class="danger" onclick="removeQuickDrink(${item.drinkId})">حذف</button>
      </div>
    </div>
  `).join("");

    totalEl.innerText = getQuickDrinksTotal();
    renderQuickDrinksOptions();
}

function clearQuickDrinksCart() {
    quickDrinksCart = [];
    renderQuickDrinksCart();
}

function confirmQuickDrinksSale() {
    if (!quickDrinksCart.length) return;

    for (let item of quickDrinksCart) {
        const originalDrink = drinksList.find(d => d.id === item.drinkId);

        if (!originalDrink || originalDrink.stock < item.quantity) {
            alert(`المخزون غير كافٍ للمشروب: ${item.name}`);
            return;
        }
    }

    quickDrinksCart.forEach(item => {
        const originalDrink = drinksList.find(d => d.id === item.drinkId);
        originalDrink.stock -= item.quantity;

        sessionsHistory.unshift({
            deviceName: "-",
            deviceType: "-",
            category: "مشروب خارجي",
            from: Date.now(),
            to: Date.now(),
            durationMs: 0,
            amount: item.totalPrice,
            details: `${item.name} × ${item.quantity}`
        });
    });

    total += getQuickDrinksTotal();

    quickDrinksCart = [];
    saveAll();
    renderTotal();
    renderHistory();
    renderQuickDrinksCart();
    renderDevices();
}


function renderHistory() {
    const body = document.getElementById("historyBody");
    body.innerHTML = "";

    if (!sessionsHistory.length) {
        body.innerHTML = `<tr><td colspan="8">لا يوجد بيانات مسجلة</td></tr>`;
        return;
    }

    sessionsHistory.forEach(item => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
      <td>${item.deviceName}</td>
      <td>${item.deviceType}</td>
      <td>${item.category}</td>
      <td>${formatDate(item.from)}</td>
      <td>${formatDate(item.to)}</td>
      <td>${item.category === "مشروب" ? "-" : formatDuration(item.durationMs)}</td>
      <td>${item.amount} جنيه</td>
      <td>${item.details}</td>
    `;
        body.appendChild(tr);
    });
}

function beep() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        oscillator.connect(gain);
        gain.connect(audioCtx.destination);
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.25);
    } catch (e) { }
}

function getAvailableDrinksOptions() {
    const available = drinksList.filter(d => Number(d.stock) > 0);

    if (!available.length) {
        return `<option value="">لا يوجد مشروبات متاحة</option>`;
    }

    return available.map(drink => `
    <option value="${drink.id}">
      ${drink.name} - ${drink.price} جنيه (متاح: ${drink.stock})
    </option>
  `).join("");
}

function renderDevices() {
    const container = document.getElementById("devices");
    container.innerHTML = "";

    devicesList.forEach(device => {
        const session = device.session;
        const canSwitchToMulti = session && !session.isPaused && session.state === "running" && session.currentMode === "عادي" && !isSessionEnded(device);
        const canSwitchToNormal = session && !session.isPaused && session.state === "running" && session.currentMode === "ملتي" && !isSessionEnded(device);
        const pauseResumeText = session && session.isPaused ? "استئناف" : "إيقاف مؤقت";
        const remaining = getRemainingTime(device);
        const ended = isSessionEnded(device);

        const card = document.createElement("div");
        card.className = "device-card";

        card.innerHTML = `
      <h3>${device.name}</h3>
      <p class="meta">النوع: ${device.type}</p>
      <p class="meta">الحالة: <span class="${getStatusClass(device)}">${getStatusText(device)}</span></p>
      <p class="meta">⏱️ الوقت الحالي: <span id="timer-${device.id}">0س 0د 0ث</span></p>
      <p class="meta">💵 الحساب الحالي: <span id="bill-${device.id}">0</span> جنيه</p>
      <p class="meta">
        مدة الجلسة:
        ${session
                ? (session.durationType === "open" ? "مفتوح" : `${session.durationMinutes} دقيقة`)
                : `<select id="duration-select-${device.id}">${getDurationPresetOptions()}</select>`
            }
      </p>
      ${session && session.durationType !== "open"
                ? `<p class="meta">⏳ المتبقي: <span id="remaining-${device.id}">${formatDuration(remaining)}</span></p>`
                : ""
            }
      ${ended ? `<div class="session-warning">⚠️ الجهاز انتهت مدته</div>` : ""}

      <div class="buttons-row">
  <button class="success" onclick="startSession(${device.id}, 'عادي')">بدء عادي</button>
  <button class="purple" onclick="startSession(${device.id}, 'ملتي')">بدء ملتي</button>
  <button class="warning" onclick="togglePauseResume(${device.id})">${pauseResumeText}</button>
  <button class="danger" onclick="stopSession(${device.id})">إنهاء</button>
  ${session ? `<button class="gray" onclick="cancelSession(${device.id})">إلغاء الجلسة</button>` : ""}
</div>

      <div class="buttons-row">
        ${canSwitchToMulti ? `<button class="purple" onclick="switchMode(${device.id}, 'ملتي')">تحويل إلى ملتي</button>` : ""}
        ${canSwitchToNormal ? `<button class="success" onclick="switchMode(${device.id}, 'عادي')">تحويل إلى عادي</button>` : ""}
        ${ended ? `<button class="primary" onclick="continueSameCustomer(${device.id})">يكمل نفس الشخص</button>` : ""}
      </div>

      <div class="device-drinks">
        <h4>🧃 مشروبات الجهاز</h4>
        <div class="settings-grid">
          <select id="drink-select-${device.id}">
            ${getAvailableDrinksOptions()}
          </select>
          <input id="drink-qty-${device.id}" type="number" min="1" value="1" placeholder="العدد">
          <button class="primary" onclick="addDrinkToDevice(${device.id})">إضافة مشروب</button>
        </div>
        <div id="device-drinks-${device.id}"></div>
      </div>
    `;

        container.appendChild(card);
    });

    updateLiveData();
}

function cancelSession(deviceId) {
    const device = devicesList.find(d => d.id === deviceId);
    if (!device || !device.session) return;

    const confirmCancel = confirm("هل أنت متأكد من إلغاء الجلسة؟ لن يتم تسجيل أي مبلغ.");

    if (!confirmCancel) return;

    if (device.session.drinks && device.session.drinks.length > 0) {
        device.session.drinks.forEach(addedDrink => {
            const originalDrink = drinksList.find(d => d.name === addedDrink.name);
            if (originalDrink) {
                originalDrink.stock += Number(addedDrink.quantity || 1);
            }
        });
    }

    device.session = null;
    endedAlerts[deviceId] = false;

    if (pendingPayment && pendingPayment.deviceId === deviceId) {
        pendingPayment = null;
        const modal = document.getElementById("paymentModal");
        if (modal) {
            modal.classList.add("hidden");
        }
    }

    saveAll();
    renderDevices();
}

function updateLiveData() {
    devicesList.forEach(device => {
        const timerEl = document.getElementById(`timer-${device.id}`);
        const billEl = document.getElementById(`bill-${device.id}`);
        const drinksEl = document.getElementById(`device-drinks-${device.id}`);
        const remainingEl = document.getElementById(`remaining-${device.id}`);

        if (!timerEl || !billEl || !drinksEl) return;

        if (device.session) {
            timerEl.innerText = formatDuration(calculateSessionTime(device));
            billEl.innerText = calculateSessionCost(device);

            if (device.session.durationType !== "open" && remainingEl) {
                remainingEl.innerText = formatDuration(getRemainingTime(device));
            }

            if (device.session.drinks.length > 0) {
                drinksEl.innerHTML = device.session.drinks.map(d => `
          <div class="drink-row">
            <div>
              <strong>${d.name}</strong>
              <div class="muted">العدد: ${d.quantity || 1}</div>
            </div>
            <div>${d.totalPrice || d.price} جنيه</div>
          </div>
        `).join("");
            } else {
                drinksEl.innerHTML = `<p class="meta">لا يوجد مشروبات مضافة</p>`;
            }

            if (isSessionEnded(device) && !endedAlerts[device.id]) {
                endedAlerts[device.id] = true;
                saveAll();
                beep();
            }
        } else {
            timerEl.innerText = "0س 0د 0ث";
            billEl.innerText = "0";
            if (remainingEl) remainingEl.innerText = "-";
            drinksEl.innerHTML = `<p class="meta">لا يوجد جلسة حالية</p>`;
        }
    });
}

function resetDay() {
    if (!confirm("متأكد إنك عاوز تصفر اليوم؟")) return;

    devicesList = devicesList.map(d => ({ ...d, session: null }));
    sessionsHistory = [];
    total = 0;
    pendingPayment = null;
    endedAlerts = {};

    saveAll();
    renderTotal();
    renderHistory();
    renderDevices();
}


renderTotal();
renderHistory();
renderDevices();
renderQuickDrinksOptions();
renderQuickDrinksCart();
setInterval(updateLiveData, 1000);