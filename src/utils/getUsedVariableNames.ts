export function getUsedVariableNames(container: any): Set<string> {
    const used = new Set<string>();
  
    function checkValue(val: any) {
      if (typeof val === "string") {
        const matches = val.match(/{{(.*?)}}/g);
        if (matches) {
          matches.forEach((m) => {
            used.add(m.replace(/{{|}}/g, "").trim());
          });
        }
      } else if (Array.isArray(val)) {
        val.forEach(checkValue);
      } else if (typeof val === "object" && val !== null) {
        Object.values(val).forEach(checkValue);
      }
    }
  
    ["tag", "trigger", "variable"].forEach((section) => {
      (container?.[section] ?? []).forEach((item: any) => {
        checkValue(item);
      });
    });
  
    return used;
  }