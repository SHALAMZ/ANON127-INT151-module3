async function getItems(url) {
    try {
        const res = await fetch(url)
        const items = await res.json()
        return items
    } catch (e){
        throw  new Error(`There is a promble , cannot read items`) 
    }
}
export {getItems}