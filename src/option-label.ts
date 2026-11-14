/** Keep native dropdown menus compact while retaining the full text in the title. */
export function optionLabel(value:string, limit=40) {
 const chars=Array.from(value);
 return chars.length>limit ? `${chars.slice(0,limit-1).join('')}…` : value;
}
