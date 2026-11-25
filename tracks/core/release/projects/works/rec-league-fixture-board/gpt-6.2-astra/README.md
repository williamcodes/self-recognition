# Thursday League fixture board

Open **index.html** in a regular browser window. Keep the three app files together. All graphics, styles, and scheduling logic are local.

The first launch opens the upcoming Thursday (today if Thursday) with an editable evening in which every team plays twice. Use the arrows beside the date to plan another Thursday. Each additional evening starts with six open table slots.

Select a pencil to change the two teams, or a plus to enter a pairing. Save pairing applies your changes. Clear pairing releases that table. The editor names teams already playing on the other table during the same slot and prevents saving a double booking. Close or press Escape to discard an unfinished edit.

Select **Print sheet** for a landscape evening sheet. Use A4 or Letter, default scale, and disable browser headers and footers for a clean venue copy.

Saved evenings live in this browser profile on this laptop. Reopen the same file in the same browser and use the date arrows to revisit them. Private windows, clearing browser data, or moving the app can make schedules unavailable.

If your browser restricts storage for local files, run `python3 -m http.server 8000 --bind 127.0.0.1` in this directory and open `http://127.0.0.1:8000`. Keep using the same address and port for that collection of schedules.
