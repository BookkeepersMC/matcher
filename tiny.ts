/*
 * Represents the tiny file parser.
 */

import { parse_function_descriptor, FunctionDescriptor, DETAILED_TYPE_REGEX } from "./java.mjs";

const HEADER_REGEX = /^tiny\t(\d)\t(\d)\t([a-z_]+)\t([a-z_]+)$/;
const CLASS_REGEX = /^c\t([A-z0-9$\/_]+)\t([A-z0-9$\/_]+)$/;
const ELEMENT_REGEX = /^\t([mf])\t(\S+)\t([A-z0-9$\/_]+)\t([A-z0-9$\/_]+)$/;

/**
 * Represents a tiny file.
 */
export class TinyFile {
    version: string;
    from_mappings: string;
    to_mappings: string;

    classes: TinyClass[];

    constructor(version: string, from_mappings: string, to_mappings: string) {
        this.version = version;
        this.from_mappings = from_mappings;
        this.to_mappings = to_mappings;

        this.classes = [];
    }

    methods() {
        return this.classes.flatMap(clazz => clazz.methods);
    }

    resolve_type(type: string): string {
        let result;
        if ((result = DETAILED_TYPE_REGEX.exec(type)) && result[2][0] === "L") {
            // const remapped_class = this.find_base_class(result[2].substr(1, result[2].length - 2));
            const remapped_class = this.find_base_class(result[2].substring(1, result[2].length - 1));
            if (remapped_class) {
                type = `${result[1]}L${remapped_class.to};`;
            }
        }

        return type;
    }

    /**
     * Finds the specified class from the base name.
     *
     * @param {string} name the base name
     * @returns {TinyClass|null} the class if found, otherwise `null`
     */
    find_base_class(name: string): TinyClass | null {
        for (const clazz of this.classes) {
            if (clazz.from === name)
                return clazz;
        }

        return null;
    }

    find_base_method(name: string): TinyMethod | null {
        for (const clazz of this.classes) {
            for (const method of clazz.methods) {
                if (method.from === name) {
                    return method;
                }
            }
        }

        return null;
    }

    find_target_field(name: string): TinyField | null {
        for (const clazz of this.classes) {
            for (const field of clazz.fields) {
                if (field.to === name) {
                    return field;
                }
            }
        }

        return null;
    }

    find_target_method(name: string): TinyMethod | null {
        for (const clazz of this.classes) {
            for (const method of clazz.methods) {
                if (method.to === name) {
                    return method;
                }
            }
        }

        return null;
    }
}

/**
 * Represents an entry in a tiny file.
 */
class TinyEntry {
    from: string;
    to: string;

    constructor(from: string, to: string) {
        this.from = from;
        this.to = to;
    }

    /**
     * Returns the type of this entry.
     *
     * @return {string} the type of this entry
     */
    get_type(): string {
        throw new ReferenceError("get_type isn't implemented.");
    }
}

/**
 * Represents a class in the tiny format.
 */
export class TinyClass extends TinyEntry {
    fields: TinyField[];
    methods: TinyMethod[];

    constructor(from: string, to: string) {
        super(from, to);

        this.fields = [];
        this.methods = [];
    }

    get_type(): string {
        return "c";
    }

    /**
     * Returns whether this class is a subclass.
     *
     * @returns {boolean} `true` if this is a subclass, otherwise `false`
     */
    is_subclass(): boolean {
        return this.from.includes("$");
    }

    push(element: TinyClassEntry) {
        if (element instanceof TinyField) {
            this.fields.push(element);
        } else if (element instanceof TinyMethod) {
            this.methods.push(element);
        } else {
            throw new Error(`Cannot add the given element ${element} to the class (${this.from} => ${this.to}): unknown type.`);
        }
    }
}

/**
 * Represents an entry inside a class.
 */
class TinyClassEntry extends TinyEntry {
    owner: TinyClass;

    /**
     * @param {TinyClass} owner the owner class
     * @param {string} from the base name
     * @param {string} to the new name
     */
    constructor(owner: TinyClass, from: string, to: string) {
        super(from, to);
        this.owner = owner;
    }
}

/**
 * Represents a field in the tiny format.
 */
export class TinyField extends TinyClassEntry {
    type: string;

    /**
     * @param {TinyClass} owner the owner class
     * @param {string} from the base name
     * @param {string} to the new name
     * @param {string} type the type/descriptor of this field
     */
    constructor(owner: TinyClass, from: string, to: string, type: string) {
        super(owner, from, to);
        this.type = type;
    }

    resolve_type(tiny_file: TinyFile) {
        return tiny_file.resolve_type(this.type);
    }

    get_type(): string {
        return "f";
    }
}

/**
 * Represents a method in the tiny format.
 */
export class TinyMethod extends TinyClassEntry {
    descriptor: FunctionDescriptor;

    /**
     * @param {TinyClass} owner the owner class
     * @param {string} from the base name
     * @param {string} to the new name
     * @param {FunctionDescriptor} descriptor the descriptor of this field
     */
    constructor(owner: TinyClass, from: string, to: string, descriptor: FunctionDescriptor) {
        super(owner, from, to);
        this.descriptor = descriptor;
    }

    /**
     * Resolves the descriptor to the target mapping.
     *
     * @param {TinyFile} tiny_file the tiny file
     * @return {FunctionDescriptor} the remapped descriptor
     */
    resolve_descriptor(tiny_file: TinyFile): FunctionDescriptor {
        const return_type = tiny_file.resolve_type(this.descriptor.return_type);
        return new FunctionDescriptor(this.descriptor.params.map((param: string) => tiny_file.resolve_type(param)), return_type);
    }

    get_type() {
        return "m";
    }
}

export function parse(source: string): TinyFile {
    const lines = source.split(/\r?\n/);

    const header = HEADER_REGEX.exec(lines[0]);
    if (!header) {
        throw new SyntaxError("Header could not be parsed.");
    }

    const tiny = new TinyFile(header[1] + "." + header[2], header[3], header[4]);
    let current_class;

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        let result = CLASS_REGEX.exec(line);

        if (result) {
            tiny.classes.push(current_class = new TinyClass(result[1], result[2]));
        } else if ((result = ELEMENT_REGEX.exec(line))) {
            if (current_class === undefined) continue;

            let element;

            switch (result[1]) {
                case "f": { // This is a field.
                    element = new TinyField(current_class, result[3], result[4], result[2]);
                    break;
                }
                case "m": { // This is a method.
                    element = new TinyMethod(current_class, result[3], result[4], parse_function_descriptor(result[2]));
                    break;
                }
                default: { // Unkown type.
                    throw new SyntaxError(`Cannot parse line ${i} ("${line}"): unknown element type ${result[1]}.`);
                }
            }

            current_class.push(element);
        } else if (line !== "") {
            throw new SyntaxError(`Could not parse line ${i}: "${line}."`);
        }
    }

    return tiny;
}
