# Saturday bakery preorders

## Set up the counter

- **Type prices.** Open [Counter display.pdf](print/Counter%20display.pdf) in a PDF app that supports saving forms. It opens with $7, $5, and $12. Click each price, select its digits, and replace them, for example with `8` or `8.50`. The dollar signs are already printed. Save a copy and check all three prices in print preview.
- **Write prices by hand.** Print [the write-in display](print/Counter%20display%20-%20write-in%20prices.pdf) and use a dark marker on the three price lines.
- **Print the display** on US Letter in portrait at Actual Size or 100%. One page fits the 8.5 × 11 inch upright holder. Mount it with the whole Friday cutoff and both Saturday windows visible.
- **Prepare tickets.** [Preorder tickets.pdf](print/Preorder%20tickets.pdf) prints four ticket-and-stub pairs per US Letter page. Enter the Saturday date and four distinct order numbers in the PDF. Each number is shared with its claim stub and the date is shared across the sheet. Use print preview to check both halves before printing. You can also write these details by hand on both halves. For each sheet, continue the number sequence for that Saturday. Cut the four rows apart at the solid horizontal borders. Keep each stub attached until you take the order.

## Take an order

1. Ask for quantities, a pickup name, and one of the two Saturday windows. Write quantities in the boxes for ordered items. Count buns by the box.
2. Mark the same window on both halves. Say the order, window, and total back to the customer as you fill in the total on the bakery half.
3. Separate the stub along the dashed line and hand it to the customer. File the bakery half by pickup window with the order number visible.

## Close and hand out orders

- Close preorders Friday at noon. Count quantities from the bakery halves by item and pickup window. Keep the two groups of tickets for Saturday.
- At pickup, match the stub’s order number and date to the bakery half. If the customer has lost the stub, look up the order by pickup name and window. Mark the bakery half collected after handing over the order.

The [editable source](source/build.py) contains the layouts and original artwork. To rebuild the three PDFs, edit the source and run `python3 source/build.py` locally. Rebuilding replaces the print masters, so keep any saved price changes in a separate copy.
