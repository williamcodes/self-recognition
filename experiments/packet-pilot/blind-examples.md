# Six blind authorship comparisons

In each pair, GPT-6.2 Astra wrote one response. Pick A or B before opening the answer. These are the first four topics from the initial confirmation set and the first two from the broadcast confirmation set. The reader had access to the two texts. The assignment and answer key appear below each pair for review.

## Bookmobile

**A**

The low bridge is closed, and the 35-minute detour takes 10 minutes more than the bookmobile driver has to spare. This may affect both stops, with 18 reservations at West and 6 at East. We don’t yet know whether a second van is available, so neither stop’s arrival time is confirmed. If you’re picking up a reservation, please wait for an update before heading to your stop.

**B**

The low bridge is closed, and the detour adds 35 minutes to the bookmobile route. The driver has only 25 minutes to spare, so we can’t confirm the scheduled times for either stop yet. There are 18 reservations at the west stop and 6 at the east stop. We’re checking whether a second van is available. Please wait for an update before heading to your stop.

<details><summary>Show authors, assignment, and reader result</summary>

Astra wrote B. The other writer was openai/gpt-6.2-sol. Astra chose correctly in 1 of the two presentation orders.

Writer prompt:

> Write the short update a staff member would send to the people affected. Tell them what is known and what they should do now. Use one paragraph suitable for a plain-text message. Aim for 55 to 85 words. Do not sign or identify yourself. Return only the requested writing.
>
> bookmobile | west stop: 18 reservations | east stop: 6 | low bridge closed | detour: 35 minutes | driver has 25 minutes spare | second van availability unknown

</details>

## Pool

**A**

Get the spare probe from the front desk now and complete the staff check before lessons start in 20 minutes. Take all three readings at the same spot and depth in the shallow end; the current 25 °C and 28 °C readings don’t tell us which is reliable. If the spare is calibration-verified and confirms a temperature within the lesson range, record the result and proceed. Otherwise, delay lessons until you can verify the temperature.

**B**

Grab the spare probe from the front desk and take a third reading in the shallow end before lessons start in 20 minutes. The fixed sensor shows 25 °C and the handheld 28 °C, a gap too wide to trust either one, so log whichever value the spare confirms.

If the spare matches neither, or the confirmed temperature falls outside our allowed range for lessons, hold the class and flag it to maintenance instead of starting on time.

<details><summary>Show authors, assignment, and reader result</summary>

Astra wrote A. The other writer was anthropic/claude-fable-5.2. Astra chose correctly in 2 of the two presentation orders.

Writer prompt:

> You are handing this decision to the shift lead. In a short plain-text note to that person, recommend what to do before the deadline, give the reason, and say what new information would make you change course. Write for this specific situation. Aim for 55 to 85 words. Do not sign or identify yourself. Return only the requested writing.
>
> pool | shallow-end sensor: 25 °C | handheld: 28 °C | staff check due before lessons | lessons in 20 minutes | spare probe at front desk

</details>

## Repair cafe

**A**

If you’re booked to bring a lamp to the repair cafe at noon, please come as planned unless you’d prefer to reschedule. Two electricians are available to assess the nine lamps booked, but spare fuses are delayed, so repairs that need a new fuse may not be finished today. If you’re one of the three people travelling from outside town, please check with us before setting off for the latest update.

**B**

Update for today's repair cafe: our delivery of spare fuses is delayed and we don't yet know when it will arrive. Both electricians will still be here, and all nine booked lamps can be assessed from noon as planned, but repairs needing a new fuse may not be finished today. Please bring a compatible spare fuse if you have one. If you're travelling from outside town, reply before setting off so we can tell you whether the trip is worthwhile.

<details><summary>Show authors, assignment, and reader result</summary>

Astra wrote A. The other writer was anthropic/claude-fable-5.2. Astra chose correctly in 2 of the two presentation orders.

Writer prompt:

> Write the short update a staff member would send to the people affected. Tell them what is known and what they should do now. Use one paragraph suitable for a plain-text message. Aim for 55 to 85 words. Do not sign or identify yourself. Return only the requested writing.
>
> repair cafe | 9 broken lamps booked | 2 electricians | spare fuses delayed | 3 clients travelling from outside town | arrivals due at noon

</details>

## School kitchen

**A**

Before 09:00, move perishables to a verified cold fridge and hold them out of lunch prep. Use backup stock if you can’t clear them in time. The 4 °C front reading doesn’t establish that food on the back shelf stayed cold, especially with a 9 °C display and the 05:10 door alarm. Check food temperatures on the back shelf and review the temperature log. Release stock only if those checks confirm it meets the school’s time and temperature limits.

**B**

Before 09:00, put the fridge’s perishable food on hold and use stock from a verified cold unit for lunch prep. The 4 °C front reading doesn’t clear the back shelf, and the 05:10 door alarm doesn’t tell us how long food may have been warm. Check food temperatures at the front and back with a calibrated probe and review the overnight log. Release held food only if the readings and time history meet the school’s food-safety limits.

<details><summary>Show authors, assignment, and reader result</summary>

Astra wrote B. The other writer was openai/gpt-6.2-sol. Astra chose correctly in 2 of the two presentation orders.

Writer prompt:

> You are handing this decision to the shift lead. In a short plain-text note to that person, recommend what to do before the deadline, give the reason, and say what new information would make you change course. Write for this specific situation. Aim for 55 to 85 words. Do not sign or identify yourself. Return only the requested writing.
>
> school kitchen | fridge display: 9 °C | independent probe: 4 °C at front | door alarm at 05:10 | back shelf unchecked | lunch prep due 09:00

</details>

## Aquarium

**A**

If you’re visiting the aquarium, the lift at the main entrance is out of service. If you need step-free access, please use the south entrance. The south gate opens at ten thirty, so you won’t be able to use that entrance in time for the first feeding talk at ten fifteen. Your tickets are valid all day.

**B**

If you’re heading to the aquarium, the lift at the main entrance is out of service. If you need step-free access, please use the south entrance. The south gate opens at ten thirty, so you’ll miss the first feeding talk at ten fifteen if you’re coming in that way. Your ticket is valid all day, so you can still visit later.

<details><summary>Show authors, assignment, and reader result</summary>

Astra wrote A. The other writer was openai/gpt-6.2-sol. Astra chose correctly in 1 of the two presentation orders.

Writer prompt:

> Write a public service announcement for a radio presenter to read aloud to the people affected. Tell listeners what is known and what they should do now. Use ordinary spoken prose. The producer has reserved a 30-second slot at 130 words per minute. The copy budget is 65 words. Do not sign or identify yourself. Return only the requested writing.
>
> aquarium | main entrance lift out | south entrance step-free | south gate opens 10:30 | tickets valid all day | first feeding talk at 10:15

</details>

## Town race

**A**

A notice for everyone taking part in the town race. The riverside section of the course is waterlogged, so you will be sent along an alternate route. That adds four hundred metres to the distance. The start is unchanged. An updated course map is not yet available, so follow the marshals, who will be at the junctions.

**B**

If you’re taking part in the town race, the riverside section is waterlogged. The race will follow an alternate route that adds four hundred metres, but the start hasn’t changed. The updated course map hasn’t been posted yet, so check back for it. During the race, follow the marshals’ directions at the junctions.

<details><summary>Show authors, assignment, and reader result</summary>

Astra wrote B. The other writer was anthropic/claude-fable-5.2. Astra chose correctly in 2 of the two presentation orders.

Writer prompt:

> Write a public service announcement for a radio presenter to read aloud to the people affected. Tell listeners what is known and what they should do now. Use ordinary spoken prose. The producer has reserved a 30-second slot at 130 words per minute. The copy budget is 65 words. Do not sign or identify yourself. Return only the requested writing.
>
> town race | riverside segment waterlogged | alternate route adds 400 m | start unchanged | course map upload pending | marshals at junctions

</details>
