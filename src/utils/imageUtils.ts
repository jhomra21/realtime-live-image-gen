export const downloadImage = (imageData: string | undefined) => {
  if (imageData) {
    const link = document.createElement('a')
    link.href = `data:image/png;base64,${imageData}`
    link.download = 'generated-image.png'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}

