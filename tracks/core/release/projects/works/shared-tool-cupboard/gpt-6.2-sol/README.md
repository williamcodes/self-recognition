# Shared Cupboard

Open **index.html** in a regular Chrome or Edge window. Keep the project files together. The app runs offline without installation or an account. Start with an empty ledger and the building’s two tagged folding tables, tagged projector, and three extension cords.

## At the lending desk

- **New checkout** records a household label, item, checkout date, and expected return date. Choose the tag on the item or enter the number of extension cords borrowed.
- **Current loans** shows everything still out, with overdue loans first. Select **Return** and enter the number handed back. A partial return frees those cords immediately and keeps the balance on the original loan.
- **New reservation** holds one tagged item or a quantity of cords for future dates. If stock is short, the form shows the tightest date and the loans or reservations using stock that day. Under **Reservations**, choose **Check out** during the booked dates to convert the hold to a loan, or **Cancel** to release it.
- **Availability** shows the minimum quantity free across the selected range. Expand overlapping commitments to see the households and dates involved.
- **Print sheet** opens a print layout with the date, household labels, outstanding quantities, checkout and due dates, and overdue status. Print it or choose **Save as PDF** from the print dialog.

Both endpoints count. A loan due on Friday is expected to free stock on Saturday, or immediately when the return is recorded. Once overdue, the outstanding quantity blocks new bookings until returned. An existing reservation still appears if a late loan blocks pickup.

The ledger lives in this browser profile at this file location. Use the same device, profile, and location for each shift. Private windows, moving the app, or clearing browser storage can leave you with an empty ledger. Printed sheets are snapshots of current loans.
