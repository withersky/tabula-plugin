// Минимальный Worker: отдаёт статические файлы из папки site/ (binding ASSETS).
// Сборка не нужна — это просто прокси к загруженным ассетам.
export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
