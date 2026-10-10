---
title: Grouped tables get the full header and rows that move between groups
summary: In a grouped table the columns could not be resized or sorted and a row could not be dragged into another group. Every group now renders the full column header, and a row moves between groups by a grip, which writes the grouped column. Asked for by Marlin on 2026-10-10 from the receipts app, where every table view is grouped. Built and released as data-table-react 0.5.0.
type: plan
status: completed
tags: [react, table, grouping, drag-and-drop, resize]
projects: [data-table, receipt-ocr-app]
date: 2026-10-10
---

# Grouped tables get the full header and rows that move between groups

## What was wrong

Marlin, working in the receipts app on 2026-10-10: a receipt sat in the wrong category group and
could not be dragged into the right one, and no column could be made wider.

Both come from one place. `TableView` draws a grouped table as one small table per group, and that
branch had its own reduced header: the column name and nothing else. Resizing, sorting, the
alignment menu and reordering exist since the first version, but only in the plain table. The
receipts app groups all three of its table views (by category, by account, by vendor), so there
the controls never showed. Rows could not be dragged at all.

A second defect hid behind the first: on release, a resize reported the width from before the
drag (a value captured when the drag began), so a consumer that stores the width stored the old
one.

## Decisions (decided by the session, say so if you disagree)

- **One header cell for both layouts.** The plain table's header cell became `renderHeaderCell`
  and every group's table uses it. Reason: two headers is how the controls went missing.
- **A drop writes the grouped column through `onCellChange`.** No new callback. Reason: moving a
  row to another group and editing that cell are the same change, so a consumer's rules for the
  edit (the receipts app derives things from the category) apply unchanged.
- **A grip, not the whole row.** The row is draggable only while its grip is held. Reason: text in
  cells stays selectable and cells stay editable by click.
- **Which columns.** Select, multi-select, text, url, number and checkbox. A multi-select row sits
  in one group per option, so a move swaps the option of the group it left and keeps the others.
  Dates are left out (a group is a day, a cell may carry a time) and computed columns cannot be
  written. For those there is no grip.
- **The selection moves together** when the dragged row is one of the selected rows.
- **Only groups that exist are drop targets.** A select option without rows has no group to drop
  on; the cell editor covers that case.
- **Mouse only.** The browser's own drag and drop, like the board and the column reorder already
  use, does not exist on most touch screens. Editing the cell works everywhere.
- **The resize handle is not a tab stop.** A grouped table repeats the header per group, which
  would add one stop per column per group. It takes focus by click and then answers the arrow
  keys.

## Verification

- 21 tests in the React package (new test setup): the value a move writes per column type, the
  handle in every group, the width reported on release, the minimum width, the arrow keys, the
  drop, the selection, a drop on the own group, the grip arming the row, and the cases without a
  grip.
- The demo app in a browser, grouped by a select column: a column dragged from 200 to 290 pixels
  in every group, and a row dragged into another group, with the target highlighted on the way.
