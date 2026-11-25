# Prop Load

An offline packing list for a community theater prop move.

## Open the app

Keep `index.html`, `styles.css`, and `app.js` together. Open `index.html` in a current desktop browser with JavaScript enabled. The app needs no server, installation, or network connection.

Add boxes using the labels written on them. Add each prop with a quantity and optionally select its box. A prop entry records a quantity that travels together. Add separate entries when copies travel in different boxes. Use the **Unassigned** filter to find props still waiting for a box. Use **Edit** to correct or delete records. Deleting a box returns its props to the unassigned list.

**Print inventory** opens the browser print dialog. The report includes each box and its contents, plus a section for unassigned props when applicable. You can also save the report as a PDF from the print dialog if your browser supports it.

The app saves to local browser storage. Continue working in the same browser profile, from the same file location, in one tab. Moving the files, clearing browser data, or using a private window can affect access to the saved list. A banner appears if the browser reports a storage error.

## Try it

1. Open the app and select **Load example**. Expect 3 boxes, 5 prop entries, and 2 unassigned entries.
2. Select **Unassigned**. Assign **Framed portrait** to **A-02** using its box menu. The portrait leaves the filtered list and the unassigned count drops to 1.
3. Add box **C-01**. Add prop **Paper lanterns** with quantity **4** and select **C-01**. Reload the page and check that the box and assignment are still present.
4. Select **Print inventory**. Check the preview for **Paper lanterns** with quantity **4** under **Box C-01**, and **Wooden calling cards** under **Unassigned props**. The preview also includes the empty **Box B-01**.
5. Close the preview. Edit **C-01**, select **Delete**, and confirm. **Paper lanterns** should appear under **Unassigned**.
6. Select **Remove example data** and confirm to clear the example and the entries added during this walkthrough. The empty packing list is ready for a real move.
