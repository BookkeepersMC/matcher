/*
 * Represents a util file about Java-related stuff.
 */

import { JavaClassFileReader } from "npm:java-class-tools";

export const SIGNATURE_REGEX = /^\((.*)\)(.+)$/;
export const TYPE_REGEX = /^(?:V|\[*(?:Z|B|C|S|I|J|F|D|L(?:[a-z0-9/]+)\/[A-Za-z0-9_]+(?:\$[A-Za-z0-9_]+)?;))$/;
export const DETAILED_TYPE_REGEX = /^(\[*)(Z|B|C|S|I|J|F|D|L(.+);)$/;
export const CLASS_FILE_READER = new JavaClassFileReader();

/**
 * Represents a JVM byte-code formatted function descriptor.
 *
 * Object types are normalized to the format `L<class_name_with_package_separated_with_slashes>;`.
 */
export class FunctionDescriptor {
    constructor(params, return_type) {
        this.params = params.map(param => param.replace(/\./g, "/"));
        this.return_type = return_type.replace(/\./g, "/");
    }

    get_lvt_index_of(ordinal, is_static) {
        let lvt = is_static ? 0 : 1;

        for (let i = 0; i < ordinal; i++) {
            lvt++;
            if (this.params[i] === "J" || this.params[i] === "D")
                lvt++;
        }

        return lvt;
    }

    /**
     * Returns whether the parameters of this descriptor are equals to the parameters of another descriptor.
     *
     * @param {FunctionDescriptor} other_descriptor the other descriptor which we compare the parameters to
     * @return {boolean} `true` if both descriptors have equals parameters, otherwise `false`
     */
    are_params_equal_with(other_descriptor) {
        if (this.params.length !== other_descriptor.params.length)
            return false;

        for (let i = 0; i < this.params.length; i++) {
            if (this.params[i] !== other_descriptor.params[i]) {
                return false;
            }
        }

        return true;
    }

    equals(other) {
        if (!(other instanceof FunctionDescriptor))
            return false;
        return this.return_type === other.return_type && this.are_params_equal_with(other);
    }

    toString() {
        return `(${this.params.join("")})${this.return_type}`;
    }
}

function parse_type(source, start = 0) {
    let parse_object = false;
    for (let i = start; i < source.length; i++) {
        const current_char = source[i];
        switch (current_char) {
            case "[": {
                if (parse_object)
                    throw new SyntaxError(`Cannot parse type, illegal character at index ${i} in string "${params}".`);
                return "[" + parse_type(source, i + 1);
            }
            case ";": {
                return source.substr(start, i - start + 1);
            }
            case "L": {
                parse_object = true;
                break;
            }
            case "V":
            case "Z":
            case "B":
            case "C":
            case "S":
            case "I":
            case "J":
            case "F":
            case "D": {
                if (!parse_object) {
                    return current_char;
                }
                break;
            }
            default: {
                if (!parse_object)
                    throw new SyntaxError(`Cannot parse type, illegal character at index ${i} in string "${params}".`);
            }
        }
    }
}

/**
 * Parses the given JVM-byte-code-format function descriptor.
 *
 * @param {string} descriptor the descriptor
 * @return {FunctionDescriptor} the parsed descriptor
 */
export function parse_function_descriptor(descriptor) {
    const result = descriptor.match(SIGNATURE_REGEX);
    if (result) {
        const raw_params = result[1];
        const return_type = result[2];

        const params = [];

        let i = 0;
        while (i < raw_params.length) {
            const type = parse_type(raw_params, i);
            params.push(type);
            i += type.length;
        }

        return new FunctionDescriptor(params, return_type);
    }

    throw new SyntaxError(`Cannot parse function descriptor "${descriptor}".`);
}
