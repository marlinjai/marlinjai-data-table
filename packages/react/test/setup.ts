// jsdom does not lay anything out, so it has no scrollIntoView. The table calls it
// to keep the keyboard-focused cell visible; in tests there is nothing to scroll.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
