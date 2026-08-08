import { forEach, isFunction, isArray } from 'min-dash';
import { domify, classes, event, delegate, query, clear, attr } from 'min-dom';

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

var __assign = function() {
    __assign = Object.assign || function __assign(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};

/**
 * @param {string} str
 *
 * @return {string}
 */
function escapeCSS(str) {
  return CSS.escape(str);
}

var ENTRY_SELECTOR = '.entry';
var PALETTE_PREFIX = 'djs-accordion-palette';
var PALETTE_SHOWN_CLS = 'shown';
var PALETTE_OPEN_CLS = 'open';
var DEFAULT_PRIORITY = 1000;
var AccordionPalette = /** @class */ (function () {
    function AccordionPalette(config, canvas, eventBus, translate) {
        var _this = this;
        this._config = __assign({}, (config || {}));
        this._canvas = canvas;
        this._eventBus = eventBus;
        this._translate = translate;
        eventBus.on('tool-manager.update', function (event) {
            var tool = event.tool;
            _this.updateToolHighlight(tool);
        });
        eventBus.on('i18n.changed', function () {
            _this._update();
        });
        eventBus.on('diagram.init', function () {
            _this._diagramInitialized = true;
            _this._rebuild();
        });
    }
    AccordionPalette.prototype.registerProvider = function (priority, provider) {
        if (!provider) {
            provider = priority;
            priority = DEFAULT_PRIORITY;
        }
        this._eventBus.on('palette.getProviders', priority, function (event) {
            event.providers.push(provider);
        });
        this._rebuild();
    };
    AccordionPalette.prototype.getEntries = function () {
        var providers = this._getProviders();
        return providers.reduce(addPaletteEntries, {});
    };
    AccordionPalette.prototype._rebuild = function () {
        if (!this._diagramInitialized) {
            return;
        }
        var providers = this._getProviders();
        if (!providers.length) {
            return;
        }
        if (!this._container) {
            this._init();
        }
        this._update();
    };
    AccordionPalette.prototype._init = function () {
        var self = this;
        var eventBus = this._eventBus;
        var parentContainer = this._getParentContainer();
        var container = this._container = domify(AccordionPalette.HTML_MARKUP);
        parentContainer.appendChild(container);
        classes(parentContainer).add(PALETTE_PREFIX + PALETTE_SHOWN_CLS);
        event.bind(container, 'mousedown', function (event) {
            event.stopPropagation();
        });
        delegate.bind(container, ENTRY_SELECTOR, 'click', function (event) {
            self.trigger('click', event);
        });
        delegate.bind(container, ENTRY_SELECTOR, 'dragstart', function (event) {
            self.trigger('dragstart', event);
        });
        event.bind(container, 'mousewheel', function (event) {
            event.stopPropagation();
            event.stopImmediatePropagation();
        });
        event.bind(container, 'wheel', function (event) {
            event.stopPropagation();
            event.stopImmediatePropagation();
        });
        eventBus.fire('palette.create', {
            container: container
        });
    };
    AccordionPalette.prototype._getProviders = function () {
        var event = this._eventBus.createEvent({
            type: 'palette.getProviders',
            providers: []
        });
        this._eventBus.fire(event);
        return event.providers;
    };
    AccordionPalette.prototype.toggleState = function (state) {
        if (state === void 0) { state = {}; }
        var eventBus = this._eventBus;
        if ('showName' in state) {
            this._config.showName = state.showName;
        }
        if ('accordion' in state) {
            this._config.accordion = state.accordion;
        }
        if ('defaultOpenGroups' in state) {
            this._config.defaultOpenGroups = state.defaultOpenGroups;
        }
        if (this.isOpen()) {
            this.close();
            this._update();
        }
        eventBus.fire('palette.changed', __assign({ open: this.isOpen() }, this._config));
    };
    AccordionPalette.prototype._update = function () {
        var translate = this._translate;
        var entriesContainer = query('.djs-palette-entries', this._container);
        var entries = this._entries = this.getEntries();
        var isAccordion = !!this._config.accordion;
        var showName = !!this._config.showName;
        var defaultOpenGroups = this._config.defaultOpenGroups || [];
        var defaultOpenMap = defaultOpenGroups.reduce(function (m, item) { return (m[item] = true) && m; }, {});
        clear(entriesContainer);
        if (isAccordion && defaultOpenGroups.length) {
            console.warn('If you use accordion mode and set multiple default expansion nodes, only the last node will be expanded.');
        }
        forEach(entries, function (entry, id) {
            if (entry.separator) {
                return;
            }
            var grouping = escapeCSS(isAccordion ? 'accordion-group' : entry.group || 'default');
            var groupName = escapeCSS(entry.group || 'default');
            // 1. 查找或者生成最外层 details 标签
            var detailsContainer = query("[data-group-details=".concat(groupName, "]"), entriesContainer);
            if (!detailsContainer) {
                detailsContainer = domify("<details class=\"djs-accordion-group\" name=\"".concat(grouping, "\"></details>"));
                attr(detailsContainer, 'data-group-details', groupName);
                entriesContainer.appendChild(detailsContainer);
                var summaryContainer = domify("<summary>".concat(translate(entry.group || 'default'), "</summary>"));
                detailsContainer.appendChild(summaryContainer);
            }
            if (defaultOpenMap[entry.group]) {
                attr(detailsContainer, 'open', 'true');
            }
            // 2. 生成 details 标签的内容主体
            var groupContainer = query("[data-group=".concat(groupName, "]"), detailsContainer);
            if (!groupContainer) {
                groupContainer = domify("<div class=\"djs-palette-group\"></div>");
                attr(groupContainer, 'data-group', groupName);
                detailsContainer.appendChild(groupContainer);
            }
            // 3. 每一个具体按钮，区分显示名称与不显示名称的区别
            var html = entry.html || '<div class="entry" draggable="true"></div>';
            var entryEl = domify(html);
            var entryItemEl;
            if (showName) {
                var control = domify("<div class=\"djs-entry-item djs-entry-with-name\"></div>");
                groupContainer.appendChild(control);
                control.appendChild(entryEl);
                entryItemEl = control;
            }
            else {
                groupContainer.appendChild(entryEl);
                entryItemEl = entryEl;
            }
            attr(entryEl, 'data-action', id);
            if (!classes(entryEl).has('entry')) {
                addClasses(entryEl, 'entry');
            }
            // 4. 设置其他内容
            if (entry.title) {
                attr(entryItemEl, 'title', entry.title);
                if (showName) {
                    var name_1 = domify("<div class=\"djs-entry-title\">".concat(entry.title, "</div>"));
                    entryItemEl.appendChild(name_1);
                }
            }
            if (entry.className) {
                addClasses(entryEl, entry.className);
            }
            if (entry.imageUrl) {
                var image = domify('<img class="djs-entry-img">');
                attr(image, 'src', entry.imageUrl);
                entryItemEl.appendChild(image);
            }
        });
        // open after update
        this.open();
    };
    AccordionPalette.prototype.trigger = function (action, event, autoActivate) {
        var entry;
        var originalEvent;
        var button = event.delegateTarget || event.target;
        if (!button) {
            return event.preventDefault();
        }
        entry = attr(button, 'data-action');
        originalEvent = event.originalEvent || event;
        return this.triggerEntry(entry, action, originalEvent, autoActivate);
    };
    AccordionPalette.prototype.triggerEntry = function (entryId, action, event, autoActivate) {
        var entries = this._entries, entry, handler;
        entry = entries[entryId];
        // when user clicks on the palette and not on an action
        if (!entry) {
            return;
        }
        handler = entry.action;
        if (this._eventBus.fire('palette.trigger', { entry: entry, event: event }) === false) {
            return;
        }
        // simple action (via callback function)
        if (isFunction(handler)) {
            if (action === 'click') {
                return handler(event, autoActivate);
            }
        }
        else {
            if (handler[action]) {
                return handler[action](event, autoActivate);
            }
        }
        // silence other actions
        event.preventDefault();
    };
    AccordionPalette.prototype._needsCollapse = function (availableHeight, entries) {
        var margin = 20 + 10 + 20;
        var entriesHeight = Object.keys(entries).length * 46;
        return availableHeight < entriesHeight + margin;
    };
    AccordionPalette.prototype.close = function () {
        this._toggleVisible(false);
    };
    AccordionPalette.prototype.open = function () {
        this._toggleVisible(true);
    };
    AccordionPalette.prototype.toggle = function () {
        if (this.isOpen()) {
            this.close();
        }
        else {
            this.open();
        }
    };
    AccordionPalette.prototype._toggleVisible = function (state) {
        var eventBus = this._eventBus;
        var parent = this._getParentContainer();
        var container = this._container;
        var cls = classes(container);
        var parentCls = classes(parent);
        cls.toggle(PALETTE_OPEN_CLS, state);
        parentCls.toggle(PALETTE_PREFIX + PALETTE_OPEN_CLS, state);
        eventBus.fire('palette.changed', {
            open: this.isOpen()
        });
    };
    AccordionPalette.prototype.isActiveTool = function (tool) {
        return tool && this._activeTool === tool;
    };
    AccordionPalette.prototype.updateToolHighlight = function (name) {
        var entriesContainer, toolsContainer;
        if (!this._toolsContainer) {
            entriesContainer = query('.djs-palette-entries', this._container);
            this._toolsContainer = query('[data-group=tools]', entriesContainer);
        }
        toolsContainer = this._toolsContainer;
        forEach(toolsContainer.children, function (tool) {
            var actionName = tool.getAttribute('data-action');
            if (!actionName) {
                return;
            }
            var toolClasses = classes(tool);
            actionName = actionName.replace('-tool', '');
            if (toolClasses.contains('entry') && actionName === name) {
                toolClasses.add('highlighted-entry');
            }
            else {
                toolClasses.remove('highlighted-entry');
            }
        });
    };
    AccordionPalette.prototype.isOpen = function () {
        return classes(this._container).has(PALETTE_OPEN_CLS);
    };
    AccordionPalette.prototype._getParentContainer = function () {
        return this._canvas.getContainer();
    };
    AccordionPalette.HTML_MARKUP = '<div class="djs-palette djs-accordion-palette">' +
        '<div class="djs-palette-entries"></div>' +
        '</div>';
    return AccordionPalette;
}());
function addClasses(element, classNames) {
    var classes$1 = classes(element);
    var actualClassNames = isArray(classNames) ? classNames : classNames.split(/\s+/g);
    actualClassNames.forEach(function (cls) { return classes$1.add(cls); });
}
function addPaletteEntries(entries, provider) {
    var entriesOrUpdater = provider.getPaletteEntries();
    if (isFunction(entriesOrUpdater)) {
        return entriesOrUpdater(entries);
    }
    forEach(entriesOrUpdater, function (entry, id) {
        entries[id] = entry;
    });
    return entries;
}
AccordionPalette.$inject = ['config.accordionPalette', 'canvas', 'eventBus', 'translate'];

// 使用 paletteProvider 同名参数 覆盖 默认 paletteProvider 构造函数
var accordionPalette = {
    __init__: ['palette'],
    palette: ['type', AccordionPalette]
};

export { accordionPalette as default };
