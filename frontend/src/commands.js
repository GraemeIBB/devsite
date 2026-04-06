/*
 * name: {
 * description: "description here!",
 * run: () => {return "something"}
 * }
 */

const commands = {
  help: {
    description: "You are here",
    run: () =>
      Object.entries(commands)
        .map(([k, v]) => `${k} --- ${v.description}`)
        .join("\n"),
  },
  clear: {
    description: "Clears the console",
    run: () => "__clear__",
  },
};
export default commands;
