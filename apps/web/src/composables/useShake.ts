// Тряска элемента (кнопка "нет денег", "нечего собирать" и т.п.).
// В шаблоне: :class="{ 'shake-x': shaking }" @animationend="shaking = false"
import { ref } from 'vue'

export function useShake() {
  const shaking = ref(false)
  function shake() {
    shaking.value = false
    requestAnimationFrame(() => (shaking.value = true)) // перезапуск при частых нажатиях
  }
  return { shaking, shake }
}
