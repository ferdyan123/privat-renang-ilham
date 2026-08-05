// Deklarasi tipe untuk CSS modules dan side-effect CSS imports
// Menghilangkan error ts(2882) "Cannot find module ... for side-effect import"
declare module '*.css' {
  const content: { [className: string]: string }
  export default content
}
