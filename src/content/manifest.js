export const manifest = {
  coin: {
    json: () => import('./props/coin/coin.json'),
    mesh: () => import('./props/coin/coin.mesh.js')
  },
  wood: {
    json: () => import('./props/wood/wood.json'),
    mesh: () => import('./props/wood/wood.mesh.js')
  }
};
