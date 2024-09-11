import * as system from "node:process";


export function getOs() {
    const os = system.platform;
    if (os === "win32") {
        return "windows";
    } else {
        return "unix"
    }

    return "unknown";
}