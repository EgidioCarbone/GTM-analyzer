export interface GTMTag {
  name: string;
  type: string;
  parameter?: { key: string; value: string }[];
}

export interface GTMTrigger {
  name: string;
  type: string;
}

export interface GTMVariable {
  name: string;
  type: string;
}

export interface GtmContainer {
  tag: any[];
  trigger: any[];
  variable?: any[];
  containerId?: string;
  publicId?: string;

}
