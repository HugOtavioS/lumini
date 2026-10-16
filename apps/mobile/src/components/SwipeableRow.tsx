import type { LucideIcon } from 'lucide-react-native';
import { useMemo, useRef, type ReactNode } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, type PanResponderGestureState } from 'react-native';

import { colors, radius, shadows } from '@/theme';
import { AppText } from './AppText';

export interface SwipeAction {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
  onPress: () => void;
}

interface SwipeableRowProps {
  children: ReactNode;
  actions: SwipeAction[];
  onPress: () => void;
  accessibilityLabel: string;
}

const ACTION_WIDTH = 72;

const isHorizontalSwipe = (_: unknown, g: PanResponderGestureState) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy);

/** Linha que revela ações ao deslizar para a esquerda (Histórico). */
export function SwipeableRow({ children, actions, onPress, accessibilityLabel }: SwipeableRowProps) {
  const openOffset = -ACTION_WIDTH * actions.length;
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);

  const animateTo = (value: number) => {
    isOpen.current = value !== 0;
    Animated.spring(translateX, { toValue: value, useNativeDriver: false, bounciness: 0, speed: 20 }).start();
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Captura o gesto horizontal antes do Pressable interno.
        onMoveShouldSetPanResponderCapture: isHorizontalSwipe,
        onMoveShouldSetPanResponder: isHorizontalSwipe,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, g) => {
          const base = isOpen.current ? openOffset : 0;
          translateX.setValue(Math.min(0, Math.max(openOffset, base + g.dx)));
        },
        onPanResponderRelease: (_, g) => {
          const base = isOpen.current ? openOffset : 0;
          animateTo(base + g.dx < openOffset / 2 ? openOffset : 0);
        },
        onPanResponderTerminate: () => animateTo(isOpen.current ? openOffset : 0),
      }),
    [openOffset],
  );

  // As ações só aparecem durante o deslize, para não vazarem nos cantos arredondados.
  const actionsOpacity = translateX.interpolate({ inputRange: [openOffset, -1, 0], outputRange: [1, 1, 0] });

  return (
    <Animated.View style={styles.container} {...panResponder.panHandlers}>
      <Animated.View style={[styles.actions, { opacity: actionsOpacity }]}>
        {actions.map((action) => (
          <Pressable
            key={action.key}
            onPress={() => {
              animateTo(0);
              action.onPress();
            }}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            style={[styles.action, { backgroundColor: action.color }]}
          >
            <action.icon size={20} color="#FFFFFF" strokeWidth={2} />
            <AppText variant="caption" weight="semibold" color="#FFFFFF">
              {action.label}
            </AppText>
          </Pressable>
        ))}
      </Animated.View>
      <Animated.View style={[styles.front, { transform: [{ translateX }] }]}>
        <Pressable
          onPress={() => (isOpen.current ? animateTo(0) : onPress())}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityHint="Deslize para a esquerda para ver as ações"
          accessibilityActions={actions.map((a) => ({ name: a.key, label: a.label }))}
          onAccessibilityAction={(event) => actions.find((a) => a.key === event.nativeEvent.actionName)?.onPress()}
          style={styles.pressable}
        >
          {children}
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.surface, ...shadows.level1 },
  actions: { ...StyleSheet.absoluteFill, flexDirection: 'row', justifyContent: 'flex-end' },
  action: { width: ACTION_WIDTH, alignItems: 'center', justifyContent: 'center', gap: 4 },
  front: { backgroundColor: colors.surface, borderRadius: radius.xl },
  pressable: { padding: 16, paddingVertical: 14 },
});
