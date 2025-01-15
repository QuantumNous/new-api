import $, { DomElement } from '../../utils/dom-core'
export class todo {
    private template: string
    private checked: boolean
    private $todo: DomElement
    private $child: DomElement
    constructor($orginElem?: DomElement) {
        this.template = `<ul class="w-e-todo"><li><span contenteditable="false"><input type="checkbox"></span></li></ul>`
        this.checked = false
        this.$todo = $(this.template)
        this.$child = $orginElem?.childNodes()?.clone(true) as DomElement
    }

    public init() {
        const $child = this.$child
        const $inputContainer = this.getInputContainer()

        if ($child) {
            $child.insertAfter($inputContainer)
        }
    }

    public getInput(): DomElement {
        const $todo = this.$todo
        const $input = $todo.find('input')
        return $input
    }

    public getInputContainer(): DomElement {
        const $inputContainer = this.getInput().parent()
        return $inputContainer
    }

    public getTodo(): DomElement {
        return this.$todo
    }
}

function createTodo($orginElem?: DomElement): todo {
    const t = new todo($orginElem)
    t.init()
    return t
}

export default createTodo
