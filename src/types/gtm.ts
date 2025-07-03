export interface GTMTag {
    tagId: string | number;
    name: string;
    type: string;
    parameter?: { key: string; value: string }[];
  }
  
  export interface GTMContainer {
    tag?: GTMTag[];
  }