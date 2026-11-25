# Bus Stop Counts

Open `index.html` in a browser. The file is self-contained and works offline with JavaScript enabled.

- Use **From** and **Through** to filter the comparison and the observation log. Both dates are inclusive. Leave either date empty for an open-ended range.
- The six fictional sessions are labeled **Sample**. Uncheck **Include fictional samples** to see just your own observations.
- Add each observation period as a separate session, even when several sessions occur at the same stop on the same date. Enter zero boardings and zero buses when no bus came. Use **Edit** in the log to correct a manually entered session.
- Entries are stored in the current browser when local file storage is available. Keep opening the same file in the same browser profile. **Export visible CSV** downloads the currently displayed rows. Clear both dates and turn off the samples to export all manual entries.

For each stop, the tool adds the minutes, boardings, and buses in the current view. Boardings per observed hour divides total boardings by the total minutes divided by 60. Boardings per bus divides total boardings by the total number of buses. A zero-bus session contributes its time and has no per-bus rate.

With all six fictional sessions visible, Maple Corner has 75 boardings, 135 minutes, and 13 buses (33.33 boardings per observed hour and 5.77 per bus). Library Square has 56 boardings, 105 minutes, and 7 buses (32.00 per observed hour and 8.00 per bus).
