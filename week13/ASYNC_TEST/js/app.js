//app.js
//ui handles

import { loadQuotes, deleteQuote } from "./quoteManagement.js"

document.addEventListener("DOMContentLoaded", async () => {
  const quoteList = document.getElementById("quoteList")
  try {
    const quotes = await loadQuotes()
    console.log(quotes) //array

    quotes.forEach((quote) => {
      const divQuoteEle = newQuoteElement(quote)
      quoteList.appendChild(divQuoteEle)
    })
  } catch (e) {
    alert(e.message)
  }
})

/*
<div class="quote-card" data-id="1">
   <p>No one is perfect</p>
   <p class="author">someone</p>
   <div class="actions">
        <button class="edit" data-id="1">Edit</button>
        <button class="delete" data-id="1">delete</button>
   </div>
</div>

*/
function newQuoteElement(quote) {
  //<div class="quote-card" data-id="1">
  const divEle = document.createElement("div")
  divEle.className = "quote-card" //class=quote-card
  divEle.dataset.id = quote.id //data-id
  //<p>No one is perfect</p>
  const pQuoteEle = document.createElement("p")
  pQuoteEle.textContent = quote.content
  divEle.appendChild(pQuoteEle)
  //   <p class="author">someone</p>
  const pAuthorEle = document.createElement("p")
  pAuthorEle.className = "author"
  pAuthorEle.textContent = quote.author
  divEle.appendChild(pAuthorEle)
  //   <div class="actions">
  const divButtons = document.createElement("div")
  divButtons.className = "actions"
  //<button class="edit" data-id="1">Edit</button>
  const editButton = document.createElement("button")
  editButton.className = "edit"
  editButton.dataset.id = quote.id
  editButton.textContent = "Edit"
  divButtons.appendChild(editButton)

  //   <button class="delete" data-id="1">delete</button>
  const deleteButton = document.createElement("button")
  deleteButton.className = "delete"
  deleteButton.dataset.id = quote.id
  deleteButton.textContent = "Delete"

  deleteButton.addEventListener("click", handleDelete)

  divButtons.appendChild(deleteButton)
  divEle.appendChild(divButtons)

  return divEle
}
//ADD
const formEle = document.getElementById("quoteForm")
formEle.addEventListener("submit", handleAddEdit)

function handleAddEdit(e) {
  e.preventDefault()
  console.log(formEle.quoteId.value) //formElement.tagIdentity.value
  console.log(formEle.content.value)
  console.log(formEle.author.value)
}

//DELETE
async function handleDelete(e) {
  // console.log(e.target)
  const ans = confirm("Do you want to delete?")
  if (ans) {
    // console.log(e.target.dataset.id)
    const id = e.target.dataset.id
    try {
      const deleteQuoteId = await deleteQuote(id)
      if (deleteQuoteId) {
        const divDeleteQuote = document.querySelector(`div[data-id="${id}"`)
        console.log(divDeleteQuote)
        const divQuoteList = document.getElementById("quoteList")
        console.log(divQuoteList)
        divQuoteList.removeChild(divDeleteQuote)
      }
    } catch (e) {
      // alert(e.message)
      console.log(e.message)
    }
  }
}
 