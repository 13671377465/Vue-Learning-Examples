'use strict'

function Mvvm(options = {}) {
    this.$options = options
    let _el = document.querySelector(this.$options.el)
    let _data = this._data = this.$options.data
    let vm = initVm.call(this)
    initObserve.call(this, _data)
    initComputed.call(this)
    new Compile(this.$options.el, vm)
    mounted.call(this._vm)
    return this._vm
}

function initVm() {
    this._vm = new Proxy(this, {
        get: (target, key, receiver) => {
            return this[key] || this._data[key] || this._computed[key]
        },
        set: (target, key, value) => {
            return Reflect.set(this._data, key, value)
        }
    })
    return this._vm
}

function initObserve(data) {
    this._data = observe(data)
}

function observe(data) {
    if(!data || typeof data !== 'object') return data
    return new Observe(data)
}

class Observe {
    constructor(data) {
        this.dep = new Dep()
        for(let key in data) {
            data[key] = observe(data[key])
        }
        return this.proxy(data)
    }
    proxy(data) {
        let dep = this.dep
        return new Proxy(data, {
            get: (target, key, receiver) => {
                if(Dep.target) {
                    if(!dep.subs.includes(Dep.exp)) {
                        dep.addSub(Dep.exp)
                        dep.addSub(Dep.target)
                    }
                }
                return Reflect.get(target, key, receiver)
            },
            set: (target, key, value) => {
                const result = Reflect.set(target, key, observe(value))
                dep.notify()
                return result
            }
        })
    }
}

class Dep {
    constructor() {
        this.subs = []
    }
    addSub(sub) {
        this.subs.push(sub)
    }
    notify() {
        this.subs.filter(item => typeof item !== 'string').forEach(sub => sub.update())
    }
}

class Compile {
    constructor(el, vm) {
        this.vm = vm
        let element = document.querySelector(el)
        let fragment = document.createDocumentFragment()
        fragment.appendChild(element)
        this.replace(fragment)
        document.body.appendChild(fragment)
    }
    replace(frag) {
        let vm = this.vm
        Array.from(frag.childNodes).forEach(node => {
            let txt = node.textContent
            let reg = /\{\{(.*?)\}\}/g
            if(node.nodeType === 1) {
                const nodeAttr = node.attributes
                Array.from(nodeAttr).forEach(item => {
                    let name = item.name
                    let exp = item.value
                    if(name.includes('v-')) {
                        node.value = vm[exp]
                        node.addEventListener('input', e => {
                            vm[exp] = e.target.value
                        })
                    }
                })
            }
            if(node.nodeType === 3 && reg.test(txt)) {
                replaceTxt()
                function replaceTxt() {
                    node.textContent = txt.replace(reg, (matchMedia, placeholder) => {
                        new Watch(vm, placeholder, replaceTxt)
                        return placeholder.split('.').reduce((obj, key) => {
                            return obj[key]
                        }, vm)
                    })
                }
            }

            if(node.childNodes && node.childNodes.length) {
                this.replace(node)
            }
        })
    }
}

class Watch {
    constructor(vm, exp, fn) {
        this.fn = fn
        this.vm = vm
        this.exp = exp
        Dep.exp = exp
        Dep.target = this
        let arr = exp.split('.')
        let val = vm
        arr.forEach(key => {
            val =val[key]
        })
        Dep.target = null
    }
    update() {
        let exp = this.exp
        let arr = exp.split('.')
        let val = this.vm
        arr.forEach(key => {
            val = val[key]
        })
        this.fn(val)
    }
}

function initComputed() {
    let vm = this
    let computed = this.$options.computed
    vm._computed = {}
    if(!computed) return
    Object.keys(computed).forEach(key => {
        this._computed[key] = computed[key].call(this._vm)
        new Watch(this._vm, key, val => {
            this._computed[key] = computed[key].call(this._vm)
        })
    })
}

function mounted() {
    let mounted = this.$options.mounted
    mounted && mounted.call(this)
}
