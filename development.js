class Observer extends EventTarget {
    constructor (data) {
      super();

      Object.assign(this, data);

      return new Proxy(this, {
        set: function (target, property, value, receiver) {
            let preset_event = new Event("preset");

            Object.assign(preset_event, {
              oldValue: Reflect.get(target, property, receiver),
              newValue: value,
            });

            target.dispatchEvent(preset_event);

            let result = Reflect.set(target, property, value);
            let post_event = new Event("post_set");

            target.dispatchEvent(post_event);

            return result;
        },
        get: function (target, property, receiver) {
          let result = Reflect.get(target, property, receiver);
          let event;

          if (typeof result === "function") {
            return result.bind(target);
          }

          event = new Event("get");

          target.dispatchEvent(event);

          return result;
        }
      });
    }
}

class Template {

  context;

  constructor (name, context) {
    this.context = new Observer(context || {});

    let source = document.getElementById(name);

    if (!source) {
      throw new Error('Template isn\'t found');
    }

    let fragment = document.createRange().createContextualFragment(source.innerHTML);
    let attrs = this.constructor.searchAttributes(fragment)
      .map(this.processAttributes.bind(this));
    let placeholders = this.constructor.searchPlaceholders(fragment)
      .map(this.processPlaceholders.bind(this));

    this.context.addEventListener("post_set", function () {
      let event = new Event("update");

      attrs.map(function (attr) {
        attr.dispatchEvent(event);
      });

      placeholders.map(function (element) {
        element.dispatchEvent(event);
      });
    });

    Reflect.set(fragment, '__proto__', this);

    return fragment;
  }

  static searchPlaceholders(node) {
    return [].concat(...this.searchNodes(node, function(node_) {
      return node_.constructor === Text && /{{[^}]+}}/.test(node_.nodeValue);
    }).map(function (text) {
      let placeholders = [];

      while (true) {
        let start = text.nodeValue.indexOf("{{");
        let end = text.nodeValue.indexOf("}}");

        if (start === -1 && end === -1) {
          break;
        }

        let placeholder = text.splitText(start);
        text = text.nextSibling.splitText(end - start + 2);
        placeholders.push(placeholder);
      }

      return placeholders;
    }));
  }

  static searchAttributes(node) {
    return [].concat(...this.searchNodes(node, function (_node) {
      if (_node instanceof HTMLElement) {
        for (let i = 0; i < _node.attributes.length; i++) {
          if (/^\[[^\]]+\]$/.test(_node.attributes[i].name)) {
            return true;
          }
        }

        return false;
      }
    }).map(function (node) {
      let list = [];

      for (let i = 0; i < node.attributes.length; i++) {
        if (/^\[[^\]]+\]$/.test(node.attributes[i].name)) {
          list.push(node.attributes[i]);
        }
      }

      return list;
    }));
  }

  static searchNodes(node, condition) {
    let results = [];

    if (condition(node)) {
      results.push(node);
    }
    else {
      for (let i = 0; i < node.childNodes.length; i++) {
        results = results.concat(this.searchNodes(node.childNodes[i], condition));
      }
    }

    return results;
  }

  processPlaceholders(element) {
    let self = this;

    (function (value) {
      element.addEventListener("update", (function handler() {
        let new_element = (function (context) { return eval(value); })(self.context);

        switch (true) {
          case new_element instanceof DocumentFragment:
            let child = Array.from(new_element.childNodes);

            element.replaceWith(...child);
            break;

          default:
            element.textContent = new_element
            break;
        }

        return handler;
      })());
    })(element.textContent.replace(/^\{{2}/, '').replace(/\}{2}$/, ''));

    return element;
  }

  processAttributes(attr) {
      let attr_origin_name = attr.name;
      let attr_name = attr.name.replace(/[\[\]]/g, "");
      let attr_clean_name = /^class/i.test(attr_name) ? "class" : attr_name;
      let is_class_handler = attr_name !== attr_clean_name;
      let classes = is_class_handler ? attr_name.split(".").slice(1) : [];
      let element = attr.ownerElement;
      let value = attr.value;
      let self = this;

      element.removeAttribute(attr_origin_name);

      if (is_class_handler) {
        if (!element.attributes[attr_clean_name]) {
          element.setAttribute(attr_clean_name, null);
        }

        element.attributes[attr_clean_name].addEventListener("update", (function handler() {
          if ((function (context) { return eval(value); })(self.context)) {
            element.classList.add(...classes);
          }
          else {
            element.classList.remove(...classes);
          }

          return handler;
        })());

        return element.attributes[attr_clean_name];
      }

      if (!element.attributes[attr_clean_name]) {
        element.setAttribute(attr_clean_name, null);
      }

      element.attributes[attr_clean_name].addEventListener("update", (function handler() {
        element.attributes[attr_clean_name].value = (function (context) { return eval(value); })(self.context) || '';

        return handler;
      })());

      return element.attributes[attr_clean_name];
  }
}

function theme(name, vars) {
  return new Template("theme_" + name, vars);
}



setTimeout(function () {


  var template = theme('test', {
    test: 100,
    who: "Мир",
    html: document.createRange().createContextualFragment("<b>Test</b> <br> <b>Test2</b>"),
  });

  console.log(template);

  setTimeout(function () {
    template.context.test = Math.round(Math.random() * 100);
  }, 2000);

  setTimeout(function () {
    template.context.red = true;
    template.context.who = "Arteм";
    template.context.html = "Xxx";
  }, 2500);

  setTimeout(function () {
    template.context.red = false;
  }, 4500);

  setTimeout(function () {
    template.context.red = true;
    template.context.who = "Ленв";
  }, 6500);

  document.body.appendChild(template);

  return;

  function createObservable(obj) {
    let newObj = new class extends EventTarget {};

    for (let prop_index = 0, props = Object.keys(obj); prop_index < props.length; prop_index++) {
      (function (prop) {
        newObj[prop] = obj[prop];
        Object.defineProperty(newObj, prop, {
            set: function (value) {
              let event = new Event("set");
              event.property = prop;
              event.newValue = value;
              event.oldValue = obj[prop];
              this.dispatchEvent(event);
              obj[prop] = event.newValue;
            },
            get: function () {
              let event = new Event("get");
              event.property = prop;
              event.value = obj[prop];
              this.dispatchEvent(event);

              return event.value || null;
            }
        });
      })(props[prop_index]);


    }

    return newObj;
  }

  var f = document.createRange().createContextualFragment(' <h1>{{ hello }}</h1> <div [class]="true ? \'ui segment\' : \'\'" [class.red]="temp.red"  [data-dinamic]="temp.dinamic"> {{ test }} - {{ test2 }} </div>')

  function nested_search(node, condition) {
    var results = [];

    if (condition(node)) {
      results.push(node);
    }
    else {
      for (var i = 0; i < node.childNodes.length; i++) {
        results = results.concat(nested_search(node.childNodes[i], condition));
      }
    }

    return results;
  }



  var result = [].concat(...nested_search(f, function(node) {
    return node.constructor === Text && /{{[^}]+}}/.test(node.nodeValue);
  }).map(function (text) {
    var results = [];

    while (true) {
      let start = text.nodeValue.indexOf("{{");
      let end = text.nodeValue.indexOf("}}");

      if (start === -1 && end === -1) {
        break;
      }

      let a = text.splitText(start);

      text = text.nextSibling.splitText(end - start + 2);

      results.push(a);
    }

    return results;
  }));

  var newResult = {};

  for (let i = 0; i < result.length; i++) {
    newResult[result[i].nodeValue.replace(/[^A-z0-9$._]+/g, '')] = result[i];
  }

  console.log(newResult);

  var temp = createObservable(newResult);

  temp.addEventListener("set", function (event) {
    if (event.oldValue instanceof Array) {
      var current = event.oldValue.shift();

      event.oldValue.map(function (node) {
        node.parentNode.removeChild(node);
      });

      event.oldValue = current;
    }

    if (event.newValue instanceof HTMLElement || event.newValue instanceof DocumentFragment) {
      if (event.newValue instanceof DocumentFragment) {
        let childNodes = Array.from(event.newValue.childNodes);

        event.oldValue.replaceWith(event.newValue);
        event.newValue = childNodes;
      }
      else {
        event.oldValue.replaceWith(event.newValue);
      }
    }
    else {
      event.newValue = new Text(event.newValue);
      event.oldValue.replaceWith(event.newValue);
    }

});

  var attrs = [].concat(...nested_search(f, function(node) {
    if (node instanceof HTMLElement) {
      for (let i = 0; i < node.attributes.length; i++) {
        if (/^\[[^\]]+\]$/.test(node.attributes[i].name)) {
          return true;
        }
      }

      return false;
    }
  }).map(function (node) {
    let list = [];

    for (let i = 0; i < node.attributes.length; i++) {
      if (/^\[[^\]]+\]$/.test(node.attributes[i].name)) {
        list.push(node.attributes[i]);
      }
    }

    return list;
  })).map(function (attr) {
    let attr_origin_name = attr.name;
    let attr_name = attr.name.replace(/[\[\]]/g, "");
    let attr_clean_name = /^class/i.test(attr_name) ? "class" : attr_name;
    let is_class_handler = attr_name !== attr_clean_name;
    let classes = is_class_handler ? attr_name.split(".").slice(1) : [];
    let element = attr.ownerElement;
    let value = attr.value;

    element.removeAttribute(attr_origin_name);

    if (is_class_handler) {
      if (!element.attributes[attr_clean_name]) {
        element.setAttribute(attr_clean_name, null);
      }

      element.attributes[attr_clean_name].addEventListener("update", (function handler() {
        if (eval(value)) {
          element.classList.add(...classes);
        }
        else {
          element.classList.remove(...classes);
        }

        return handler;
      })());

      return element.attributes[attr_clean_name];
    }


    if (!element.attributes[attr_clean_name]) {
      element.setAttribute(attr_clean_name, null);
    }

      element.attributes[attr_clean_name].addEventListener("update", (function handler() {

        element.attributes[attr_clean_name].value = eval(value);


        return handler;
      })());

    return element.attributes[attr_clean_name];
  });

  temp.addEventListener('set', function () {
    var event = new Event('update');

    attrs.map(function (attr) {
      attr.dispatchEvent(event);
    });
  });

  console.log(attrs);

  console.log('a')

  temp.test = "123";
  temp.test2 = "Ахуеть";
  temp.dinamic = "Ахуеть0";
  temp.red = true;
  temp.hello = "Привет"

  setTimeout(function () {
    console.log('b')
    temp.test = document.createRange().createContextualFragment("<b>312</b>");
    temp.dinamic = "Ахуеть1";
  }, 1000);

  setTimeout(function () {
    console.log('c');
    temp.test = "666";
    temp.dinamic = "Ахуеть2";
    temp.red = false;
  }, 2000);

  setTimeout(function () {
    console.log('d')
    temp.test = "";
    temp.dinamic = "Ахуеть3";
    temp.hello = "Привет Мир!";
  }, 3000);

  setTimeout(function () {
    console.log('e')
    temp.test = "100";
    temp.dinamic = "Ахуеть4";
  }, 4000);

  setTimeout(function () {
    console.log('e')
    temp.test = document.createElement('img');
    temp.dinamic = "Ахуеть5";
  }, 5000);

  document.body.appendChild(f);

}, 300);