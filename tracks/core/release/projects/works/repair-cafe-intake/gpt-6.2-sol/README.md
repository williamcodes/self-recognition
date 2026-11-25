# Mend Desk

Mend Desk is an offline intake and pickup board for a monthly clothing repair café. It starts with an empty board.

## Open the desk

1. Keep `index.html`, `styles.css`, and `app.js` together in a folder on the shared laptop.
2. Open `index.html` in a regular Chrome window and wait for **Stored on this device**. Bookmark the page for the next café.
3. Keep using the same browser profile and file location. Tickets are saved in the browser’s local database and survive refresh and ordinary browser restarts. Clearing browser site data or using a private window can remove or hide those records. The browser profile holds the records, so copying the app files alone will not copy tickets.

## At the table

| When | What to do |
| --- | --- |
| A visitor arrives | Enter the garment and choose a repair. Add up to two more items for the same visitor, then select **Save ticket**. All saved items start as **Waiting**. |
| You label the items | Select **View tags**. Each garment gets a unique code such as **001-A**. Copy it onto a paper tag and a pickup slip, or print the matching pairs and cut along the dashed lines. |
| You take on a repair | Search by tag, garment, or repair. A ticket number such as **001** finds all its items. Set the item’s status to **In progress**. |
| An item is ready | Set the status to **Ready**. At pickup, match the slip number to the garment tag. |
| A status was set by mistake | Select **Undo** for the last move, or choose the correct status in the item’s dropdown. The dropdown also works after a refresh. |
| You need a previous café day | Switch **Show** to **All dates**. Ticket numbers continue across dates, so old and new garment tags remain distinct. Click any tag number to reprint that ticket’s pairs. |

Record garment and repair details only. The desk has no visitor name or contact fields. A ticket is recorded when its tag codes appear below the form. If you refresh while filling out an unsaved ticket, you’ll need to re-enter it.
