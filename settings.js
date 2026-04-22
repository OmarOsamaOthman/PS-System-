const defaultSettings = {
    prices: {

        PS4: { normal: 15, multi: 20 },

        PS5: { normal: 20, multi: 30 }

    }
};


let appSettings =
    JSON.parse(
        localStorage.getItem("appSettings")
    )
    ||
    defaultSettings;



let devicesList =
    JSON.parse(
        localStorage.getItem("devicesList")
    )
    ||
    [];



let drinksList =
    JSON.parse(
        localStorage.getItem("drinksList")
    )
    ||
    [];



function saveAll() {

    localStorage.setItem(
        "appSettings",
        JSON.stringify(appSettings)
    );


    localStorage.setItem(
        "devicesList",
        JSON.stringify(devicesList)
    );


    localStorage.setItem(
        "drinksList",
        JSON.stringify(drinksList)
    );

}



let toastTimer = null;



function showToast(message, type = "success") {

    const toast = document.getElementById("toast");

    if (!toast) return;


    toast.className = "toast";

    toast.textContent = message;


    if (type === "success")
        toast.classList.add("toast-success");


    else if (type === "danger")
        toast.classList.add("toast-danger");


    else
        toast.classList.add("toast-info");


    clearTimeout(toastTimer);


    toastTimer = setTimeout(() => {

        toast.classList.add("hidden");

    }, 2200);

}



function loadPrices() {

    document.getElementById("ps4Normal").value =
        appSettings.prices.PS4.normal;


    document.getElementById("ps4Multi").value =
        appSettings.prices.PS4.multi;


    document.getElementById("ps5Normal").value =
        appSettings.prices.PS5.normal;


    document.getElementById("ps5Multi").value =
        appSettings.prices.PS5.multi;

}



function savePrices() {

    const ps4Normal =
        Number(document.getElementById("ps4Normal").value);


    const ps4Multi =
        Number(document.getElementById("ps4Multi").value);


    const ps5Normal =
        Number(document.getElementById("ps5Normal").value);


    const ps5Multi =
        Number(document.getElementById("ps5Multi").value);



    if (ps4Normal <= 0 ||
        ps4Multi <= 0 ||
        ps5Normal <= 0 ||
        ps5Multi <= 0) {

        showToast("ادخل اسعار صحيحة", "danger");

        return;

    }


    appSettings.prices = {

        PS4: {
            normal: ps4Normal,
            multi: ps4Multi
        },

        PS5: {
            normal: ps5Normal,
            multi: ps5Multi
        }

    };


    saveAll();


    showToast("تم حفظ الأسعار");

}



function addDevice() {

    const name =
        document.getElementById("deviceName").value.trim();


    const type =
        document.getElementById("deviceType").value;



    if (!name) {

        showToast("اكتب اسم الجهاز", "danger");

        return;

    }


    devicesList.push({

        id: Date.now(),

        name,

        type,

        session: null

    });


    saveAll();


    renderDevicesSettings();


    renderStats();


    document.getElementById("deviceName").value = "";


    showToast("تمت إضافة الجهاز");

}



function updateDevice(id) {

    const nameInput =
        document.getElementById(`device-name-${id}`);


    const typeInput =
        document.getElementById(`device-type-${id}`);



    const device =
        devicesList.find(d => d.id === id);


    if (!device) return;



    device.name =
        nameInput.value.trim();


    device.type =
        typeInput.value;



    saveAll();


    renderDevicesSettings();


    showToast("تم حفظ التعديلات");

}



function deleteDevice(id) {

    const device =
        devicesList.find(d => d.id === id);


    if (device.session) {

        showToast("لا يمكن حذف جهاز عليه جلسة", "danger");

        return;

    }


    devicesList =
        devicesList.filter(d => d.id !== id);


    saveAll();


    renderDevicesSettings();


    renderStats();


    showToast("تم حذف الجهاز");

}



function addDrink() {

    const name =
        document.getElementById("drinkName").value.trim();


    const price =
        Number(document.getElementById("drinkPrice").value);


    const stock =
        Number(document.getElementById("drinkStock").value);



    if (!name || price <= 0 || stock < 0) {

        showToast("ادخل بيانات صحيحة", "danger");

        return;

    }


    drinksList.push({

        id: Date.now(),

        name,

        price,

        stock

    });


    saveAll();


    renderDrinksSettings();


    renderStats();


    document.getElementById("drinkName").value = "";


    document.getElementById("drinkPrice").value = "";


    document.getElementById("drinkStock").value = "";


    showToast("تم إضافة المشروب");

}



function updateDrink(id) {

    const nameInput =
        document.getElementById(`drink-name-${id}`);


    const priceInput =
        document.getElementById(`drink-price-${id}`);


    const stockInput =
        document.getElementById(`drink-stock-${id}`);



    const drink =
        drinksList.find(d => d.id === id);



    if (!drink) return;



    drink.name = nameInput.value.trim();


    drink.price = Number(priceInput.value);


    drink.stock = Number(stockInput.value);


    saveAll();


    renderDrinksSettings();


    renderStats();


    showToast("تم حفظ التعديلات");

}



function deleteDrink(id) {

    drinksList =
        drinksList.filter(d => d.id !== id);


    saveAll();


    renderDrinksSettings();


    renderStats();


    showToast("تم حذف المشروب");

}



function renderStats() {

    document.getElementById("devicesCount").innerText =
        devicesList.length;


    document.getElementById("drinksTypesCount").innerText =
        drinksList.length;


    document.getElementById("drinksStockCount").innerText =
        drinksList.reduce((sum, d) => sum + d.stock, 0);

}



function renderDevicesSettings() {
    const container = document.getElementById("devicesSettingsList");
    container.innerHTML = "";

    if (!devicesList.length) {
        container.innerHTML = `<p>لا يوجد أجهزة.</p>`;
        return;
    }

    devicesList.forEach((device, index) => {
        const div = document.createElement("div");
        div.className = "settings-item draggable-device";
        div.setAttribute("draggable", "true");
        div.dataset.id = device.id;
        div.dataset.index = index;

        div.innerHTML = `
      <div class="device-item-head">
        <div>
          <h3>${device.name}</h3>
          <span class="inline-note">اسحب لإعادة الترتيب</span>
        </div>
        <span class="drag-handle">⋮⋮</span>
      </div>

      <div class="settings-grid">
        <div class="field">
          <label>اسم الجهاز</label>
          <input id="device-name-${device.id}" type="text" value="${device.name}">
        </div>

        <div class="field">
          <label>نوع الجهاز</label>
          <select id="device-type-${device.id}">
            <option value="PS4" ${device.type === "PS4" ? "selected" : ""}>PS4</option>
            <option value="PS5" ${device.type === "PS5" ? "selected" : ""}>PS5</option>
          </select>
        </div>
      </div>

      <div class="small-actions">
        <button class="primary" onclick="updateDevice(${device.id})">حفظ التعديلات</button>
        <button class="danger" onclick="deleteDevice(${device.id})">حذف</button>
      </div>
    `;

        addDragEvents(div);
        container.appendChild(div);
    });
}



function renderDrinksSettings() {

    const container =
        document.getElementById("drinksSettingsList");


    container.innerHTML = "";


    drinksList.forEach(drink => {


        container.innerHTML += `

<div class="settings-item">

<h3>${drink.name}</h3>


<div class="settings-grid">

<div class="field">

<label>اسم المشروب</label>

<input id="drink-name-${drink.id}"
value="${drink.name}">

</div>


<div class="field">

<label>السعر</label>

<input id="drink-price-${drink.id}"
value="${drink.price}"
type="number">

</div>


<div class="field">

<label>الكمية</label>

<input id="drink-stock-${drink.id}"
value="${drink.stock}"
type="number">

</div>

</div>


<div class="small-actions">

<button class="primary"
onclick="updateDrink(${drink.id})">

حفظ التعديلات

</button>


<button class="danger"
onclick="deleteDrink(${drink.id})">

حذف

</button>

</div>

</div>

`;

    });

}

let draggedDeviceId = null;

function addDragEvents(element) {
    element.addEventListener("dragstart", handleDragStart);
    element.addEventListener("dragover", handleDragOver);
    element.addEventListener("drop", handleDrop);
    element.addEventListener("dragend", handleDragEnd);
    element.addEventListener("dragenter", handleDragEnter);
    element.addEventListener("dragleave", handleDragLeave);
}

function handleDragStart(e) {
    draggedDeviceId = Number(this.dataset.id);
    this.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(draggedDeviceId));
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
}

function handleDragEnter(e) {
    e.preventDefault();
    if (Number(this.dataset.id) !== draggedDeviceId) {
        this.classList.add("drag-over");
    }
}

function handleDragLeave() {
    this.classList.remove("drag-over");
}

function handleDrop(e) {
    e.preventDefault();
    this.classList.remove("drag-over");

    const targetId = Number(this.dataset.id);
    const sourceId = draggedDeviceId;

    if (!sourceId || sourceId === targetId) return;

    const sourceIndex = devicesList.findIndex(d => d.id === sourceId);
    const targetIndex = devicesList.findIndex(d => d.id === targetId);

    if (sourceIndex === -1 || targetIndex === -1) return;

    const [movedItem] = devicesList.splice(sourceIndex, 1);
    devicesList.splice(targetIndex, 0, movedItem);

    saveAll();
    renderDevicesSettings();
    renderStats();
    showToast("تم تغيير ترتيب الأجهزة", "info");
}

function handleDragEnd() {
    draggedDeviceId = null;
    document.querySelectorAll(".draggable-device").forEach(item => {
        item.classList.remove("dragging", "drag-over");
    });
}



loadPrices();

renderDevicesSettings();

renderDrinksSettings();

renderStats();
