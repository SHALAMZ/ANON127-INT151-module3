// js/myLib/fetchUtils.js

//fetch API
async function getItems(url) {
  let message = "";
  try {
    const res = await fetch(url);
    if (res.status !== 200) {
      switch (res.status) {
        case 401: message = "401 - UnAuthorized"; break;
        case 404: message = "404 - Item not found"; break;
        default:  message = "There is a problem, Please try again";
      }
      throw new Error(message);
    }
    return await res.json();
  } catch (e) {
    throw new Error(message || e.message);
  }
}

async function deleteItem(url, id) {
  try {
    const res = await fetch(`${url}/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`Fail to delete item: ${res.status} - ${res.statusText}`);
    // json-server คืน body ว่างสำหรับ DELETE; คืน id ก็พอ
    return id;
  } catch (e) {
    throw new Error(e.message);
  }
}

async function addItem(url, item) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    if (!res.ok) throw new Error(`Fail to add item: ${res.status} - ${res.statusText}`);
    return await res.json(); // json-server คืน object ที่ถูกสร้าง (มี id)
  } catch (e) {
    throw new Error(e.message);
  }
}

export { getItems, deleteItem, addItem };
