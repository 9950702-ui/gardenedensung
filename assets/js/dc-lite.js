/* Garden of Eden SC Sung: tiny runtime that renders page logic into the HTML.
   Elements carry data-t-<attr> / data-t-text templates, data-if conditions,
   data-on-<event> handler names and data-ref names. */
(function () {
  'use strict';
  var HOLE = /\{\{\s*([\w.$]+)\s*\}\}/g;
  function get(o, path) {
    var parts = path.split('.');
    for (var i = 0; i < parts.length; i++) { if (o == null) return undefined; o = o[parts[i]]; }
    return o;
  }
  function fill(tpl, vals) {
    return tpl.replace(HOLE, function (m, p) {
      if (p === 'true') return 'true';
      if (p === 'false') return 'false';
      var v = get(vals, p);
      return v == null ? '' : String(v);
    });
  }
  function DCLogic(props) { this.props = props || {}; this.state = {}; }
  DCLogic.prototype.setState = function (u, cb) {
    Object.assign(this.state, typeof u === 'function' ? u(this.state) : u);
    if (this.__render) this.__render();
    if (cb) cb();
  };
  DCLogic.prototype.forceUpdate = function () { if (this.__render) this.__render(); };
  window.DCLogic = DCLogic;

  window.mountPage = function (Component, root, props) {
    root = root || document.body;
    var inst = new Component(props || {});
    var attrB = [], textB = [], ifB = [];
    root.querySelectorAll('*').forEach(function (el) {
      Array.prototype.slice.call(el.attributes).forEach(function (a) {
        if (a.name.indexOf('data-t-') === 0) {
          var name = a.name.slice(7);
          if (name === 'text') textB.push({ el: el, tpl: a.value, last: null });
          else attrB.push({ el: el, name: name, tpl: a.value, last: null });
        }
      });
      if (el.hasAttribute('data-if')) ifB.push({ el: el, path: el.getAttribute('data-if') });
    });
    function render() {
      var v = inst.renderVals();
      attrB.forEach(function (b) {
        var s = fill(b.tpl, v);
        if (s !== b.last) { b.el.setAttribute(b.name, s); b.last = s; }
      });
      textB.forEach(function (b) {
        var s = fill(b.tpl, v);
        if (s !== b.last) { b.el.textContent = s; b.last = s; }
      });
      ifB.forEach(function (b) { b.el.hidden = !get(v, b.path); });
      return v;
    }
    inst.__render = render;
    var vals = render();
    root.querySelectorAll('[data-ref]').forEach(function (el) {
      var fn = get(vals, el.getAttribute('data-ref'));
      if (typeof fn === 'function') fn(el);
    });
    ['click', 'input', 'keydown', 'pointerdown'].forEach(function (ev) {
      root.querySelectorAll('[data-on-' + ev + ']').forEach(function (el) {
        var name = el.getAttribute('data-on-' + ev);
        el.addEventListener(ev, function (e) {
          var fn = get(inst.renderVals(), name);
          if (typeof fn === 'function') fn(e);
        });
      });
    });
    if (inst.componentDidMount) inst.componentDidMount();
    render();
    return inst;
  };
})();
