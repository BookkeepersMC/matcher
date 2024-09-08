/*
 * Bunch of stuff to deal with Enigma mappings.
 */

import * as java from "./java.mjs";

/**
 * Represents a simple mapping.
 */
export class Mapping {
    comments = []

    constructor(intermediary, named) {
        this.intermediary = intermediary;
        this.named = named;
    }
}

/** 
 * Represents a mapping field.
 */
export class Field extends Mapping {
    constructor(owner_class, intermediary, named, type) {
        super(intermediary, named);
        this.owner_class = owner_class;
        this.type = type;
    }

    get_full_intermediary() {
        return `${this.owner_class.intermediary}#${this.intermediary}`
    }

    toString() {
        return this.get_full_intermediary() + this.type;
    }
}

// Represent a mapping method.
export class Method extends Mapping {
    args = [];

    constructor(owner_class, intermediary, named, descriptor) {
        super(intermediary, named);
        this.owner_class = owner_class;

        if (typeof descriptor === "string") {
            this.descriptor = java.parse_function_descriptor(descriptor);
        } else {
            this.descriptor = descriptor;
        }
    }

    detailed_params(is_static) {
        let lvt = is_static ? 0 : 1;
        const params = [];

        for (const param of this.descriptor.params) {
            const arg = this.args[lvt];

            params.push({
                lvt: lvt,
                type: param,
                name: arg ? arg.named : undefined,
                comments: arg ? arg.comments : []
            });

            lvt++;
            if (param === "J" || param === "D")
                lvt++; // The poor JVM choice of making 64-bit integers and 64-bit floats take 2 LVT slots.
        }

        return params;
    }

    get_full_intermediary() {
        return `${this.owner_class.intermediary}#${this.intermediary}`;
    }

    get_full_named() {
        return `${this.owner_class.get_full_named()}#${this.named}`;
    }

    /**
     * Renames a method and saves it to disk.
     *
     * @param {string} str the new name or replaced string
     * @param {RegExp} regex the regex to find and replace a part of the name
     */
    rename(str, regex = null) {
        if (regex != null) {
            this.named = this.named.replace(regex, str);
        } else {
            this.named = str;
        }
        this.owner_class.save();
    }

    /**
     * Returns the method's owner class intermediary with the method intermediary and its signature as a string.
     *
     * @return {string} the full signature
     */
    toString() {
        return this.get_full_intermediary() + this.descriptor.toString();
    }

    to_named_string() {
        return this.get_full_named() + this.descriptor.toString();
    }
}

// Represent a mapping class.
export class Class extends Mapping
{
    // File is defined when the class is not an inner class.
    file = undefined;
    fields = []
    methods = []
    classes = []

    /**
     * @param {String} intermediary the intermediary of the class
     * @param {String} named the name of the class
     * @param {Class|undefined} owner_class the owner class, may be `undefined`
     */
    constructor(intermediary, named, owner_class = undefined) {
        super(intermediary, named);
        this.owner_class = owner_class;
    }

    named_starts_with(start) {
        return this.get_full_named().startsWith(start);
    }

    get_full_named() {
        let name = "";
        if (this.owner_class !== undefined) {
            name = this.owner_class.get_full_named() + "$";
        }
        if (this.named !== undefined)
            name += this.named;
        return name;
    }

    find_field(name) {
        return this.fields.find(field => field.intermediary === name);
    }

    find_method(name, with_signature = false) {
        return this.methods
            .find(method => (with_signature ? method.intermediary + method.signature : method.intermediary) === name);
    }

    find_class(name) {
        return this.classes.find(obj => obj.intermediary === name);
    }

    save() {
        if (this.owner_class !== undefined) {
            this.owner_class.save();
        } else if (this.file !== undefined) {
            write_class_mapping("", "", this);
        }
    }

    toString() {
        let full = this.intermediary;
        if (this.owner_class) {
            full = this.owner_class.toString() + "$" + full;
        }
        return full;
    }
}

export class Mappings {
    base_classes = []
    classes = []
    fields = []
    methods = []

    constructor(name) {
        this.name = name;
    }

    build_tree(classes) {
        classes.forEach(object => this.append_tree(object));
    }

    /**
     * Appends a new mapping class to the mappings.
     *
     * @param {Class} object the new mapping class
     */
    append_tree(object) {
        if (object.intermediary === undefined)
            return;
        if (object.file !== undefined)
            this.base_classes.push(object);
        this.classes.push(object);
        object.fields.forEach(field => this.fields.push(field));
        object.methods.forEach(method => this.methods.push(method));
        object.classes.forEach(inner => this.append_tree(inner));
    }

    rebuild_tree() {
        this.fields = this.classes.flatMap(clazz => clazz.fields);
        this.methods = this.classes.flatMap(clazz => clazz.methods);
    }

    find_field(name) {
        return this.fields.find(field => field.intermediary === name);
    }

    find_method(name) {
        return this.methods.find(method => method.intermediary === name);
    }

    /**
     * Searches a class from its intermediary name.
     *
     * @param {String} name the intermediary name of the class
     * @returns {Class|undefined} the class if found, else `undefined`
     */
    find_class(name) {
        if (name.includes("$")) {
            const split = name.split("$");
            return this.classes.find(obj => obj.intermediary === split[split.length - 1]);
        }
        return this.classes.find(obj => obj.intermediary === name);
    }

    show_stats() {
        console.log(`Mappings ${this.name} has: ${this.classes.length} classes, ${this.fields.length} fields, ${this.methods.length} methods`);
    }
}

export function parse_class_mapping(input) {
    const lines = input.split("\n");

    // The parsed mapping class.
    let return_class;

    let current_object;
    let current_method;

    // 0 is the return class.
    const current_classes = [];

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        const scope = (line.match(/\t/g) || []).length;

        line = line.replace(/\t/g, "");

        const map = line.split(" ");

        const type = map[0];

        let current_class = current_classes.length === 0 ? undefined : current_classes[scope - 1];

        while (current_classes.length > scope + 1)
            current_classes.pop();

        if (type === "CLASS") {
            current_object = new Class(map[1], map[2], current_class);
            if (scope == 0) {
                return_class = current_object;
                current_classes[0] = return_class;
            } else {
                current_classes[scope] = current_object;
                current_class.classes.push(current_object);
            }
            current_class = current_object;
            continue;
        }

        if (scope == 1 && current_class !== return_class) {
            current_class = return_class;
        }

        switch (type) {
            case "METHOD": {
                const intermediary = map[1];
                const named = (map.length === 4) ? map[2] : "";
                const signature = (map.length === 4) ? map[3] : map[2];
                current_object = current_method = new Method(current_class, intermediary, named, signature);
                current_class.methods.push(current_method);
                break;
            }
            case "FIELD": {
                if (map[3] === undefined) {
                    current_class.fields.push(current_object = new Field(current_class, map[1], "", map[2]));
                } else {
                    current_class.fields.push(current_object = new Field(current_class, map[1], map[2], map[3]));
                }
                break;
            }
            case "ARG": {
                // Arguments can also get comments.
                current_object = current_method.args[parseInt(map[1])] = new Mapping(undefined, map[2]);
                break;
            }
            case "COMMENT": {
                current_object.comments.push(line.replace(/COMMENT ?/, ""))
                break;
            }
            default: {
                break;
            }
        }
    }

    return return_class;
}

export function stringify_comments(object, scope) {
    scope++;

    let mapping = "";

    object.comments.forEach(comment => {
        for (let i = 0; i < scope; i++) {
            mapping += "\t";
        }

        mapping += "COMMENT";
        if (comment)
            mapping += ` ${comment}`;
        mapping += "\n"
    });

    return mapping;
}

/**
 * Stringifies intermediary and yarn names into the Enigma mapping format.
 *
 * @param {String} intermediary intermediary string
 * @param {String} named named string
 */
export function stringify_names(intermediary, named) {
    let result = "";
    if (intermediary !== undefined && intermediary !== "undefined" && intermediary.length != 0)
        result += ` ${intermediary}`;
    if (named !== undefined && named !== "undefined" && named.length != 0)
        result += ` ${named}`;
    return result;
}

export function stringify_class_mapping(clazz, scope = 0) {
    let mapping = "";
    for (let i = 0; i < scope; i++) {
        mapping += "\t";
    }

    mapping += `CLASS${stringify_names(clazz.intermediary, clazz.named)}\n`;

    mapping += stringify_comments(clazz, scope);

    scope++;

    // Fields.
    clazz.fields.forEach(field => {
        for (let i = 0; i < scope; i++) {
            mapping += "\t";
        }
        mapping += `FIELD${stringify_names(field.intermediary, field.named)} ${field.type}\n`;

        mapping += stringify_comments(field, scope);
    });

    // Methods.
    clazz.methods.forEach(method => {
        for (let i = 0; i < scope; i++) {
            mapping += "\t";
        }
        mapping += `METHOD${stringify_names(method.intermediary, method.named)} ${method.descriptor.toString()}\n`;

        mapping += stringify_comments(method, scope);

        scope++;

        for (let index = 0; index < method.args.length; index++) {
            const arg = method.args[index];

            if (arg === undefined || arg.named === undefined || arg.named === "undefined")
                continue;

            for (let i = 0; i < scope; i++) {
                mapping += "\t";
            }

            mapping += `ARG ${index} ${arg.named}\n`

            mapping += stringify_comments(arg, scope);
        }

        scope--;
    });

    // Inner classes.
    clazz.classes.map(inner_class => stringify_class_mapping(inner_class, scope))
        .forEach(inner_class => mapping += inner_class);

    return mapping;
}

export function read_class_mapping(file) {
    const object = parse_class_mapping(Deno.readTextFileSync(file));
    object.file = file;
    return object;
}

export function read_mappings(root, mappings) {
    for (const dirEntry of Deno.readDirSync(root)) {
        if (dirEntry.isFile) {
            mappings.append_tree(read_class_mapping(root + dirEntry.name));
        } else if (dirEntry.isDirectory) {
            read_mappings(root + dirEntry.name + "/", mappings);
        }
    }
}

export function write_class_mapping(old_root, new_root, clazz) {
    const mapping = stringify_class_mapping(clazz);

    const file = clazz.file.replace(old_root, new_root);

    const path = file.split("/");

    let dir = "";

    for (let i = 0; i < path.length - 1; i++) {
        dir += path[i] + "/";
    }

    Deno.mkdirSync(dir, { recursive: true });

    Deno.writeTextFileSync(file, mapping);
}

export function replace_class_mapping(current_root, old_root, new_root, old_class, new_class) {
    const old_file = old_class.file.replace(old_root, new_root);
    Deno.removeSync(old_file);
    old_class.named = new_class.named;
    old_class.file = new_class.file.replace(current_root, new_root);
    write_class_mapping("", "", old_class);
}

export function write_mappings(root, output, mappings) {
    mappings.base_classes.forEach(clazz => {
        write_class_mapping(root, output, clazz);
    });
}
