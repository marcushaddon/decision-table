export type TableDoc = {
  name?: string,
  vars: {
    [varName: string]: string[] | "boolean"
  },

  rules: {
    condition: { [varName: string]: string | string[] },
    action: string,
  }[]
}