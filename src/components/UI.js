// src/components/UI.js
import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, shadow } from '../utils/theme';

// Kid color avatar circle
export function Avatar({ name, colorIndex, size = 36 }) {
  const bg = colorIndex >= 0 ? colors.kidsLight[colorIndex % 5] : colors.primaryLight;
  const fg = colorIndex >= 0 ? colors.kids[colorIndex % 5] : colors.primary;
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={[styles.avatarText, { color: fg, fontSize: size * 0.38 }]}>{name?.charAt(0)?.toUpperCase()}</Text>
    </View>
  );
}

// Coloured tag/pill
export function Tag({ label, colorIndex, type = 'kid' }) {
  const bg = type === 'kid' ? colors.kidsLight[colorIndex % 5] : colors.primaryLight;
  const fg = type === 'kid' ? colors.kids[colorIndex % 5] : colors.primaryDark;
  return (
    <View style={[styles.tag, { backgroundColor: bg }]}>
      <Text style={[styles.tagText, { color: fg }]}>{label}</Text>
    </View>
  );
}

// Status badge
export function StatusBadge({ status }) {
  const map = {
    pending: { bg: colors.warningLight, color: colors.warning, label: 'Pending' },
    onway: { bg: colors.infoLight, color: colors.info, label: 'On my way' },
    done: { bg: colors.successLight, color: colors.success, label: 'Done' },
  };
  const s = map[status] || map.pending;
  return (
    <View style={[styles.tag, { backgroundColor: s.bg }]}>
      <Text style={[styles.tagText, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

// Section header
export function SectionHeader({ title, action, onAction }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && (
        <TouchableOpacity onPress={onAction}>
          <Text style={styles.sectionAction}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// Empty state
export function EmptyState({ icon, title, subtitle }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </View>
  );
}

// Primary button
export function PrimaryButton({ label, onPress, disabled, color }) {
  return (
    <TouchableOpacity
      style={[styles.primaryBtn, { backgroundColor: color || colors.primary }, disabled && { opacity: 0.5 }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Text style={styles.primaryBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

// Ghost button
export function GhostButton({ label, onPress, color }) {
  return (
    <TouchableOpacity style={[styles.ghostBtn, { borderColor: color || colors.border }]} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.ghostBtnText, { color: color || colors.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// Card wrapper
export function Card({ children, style, onPress }) {
  if (onPress) {
    return (
      <TouchableOpacity style={[styles.card, shadow.sm, style]} onPress={onPress} activeOpacity={0.85}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={[styles.card, shadow.sm, style]}>{children}</View>;
}

// Time display helper
export function formatTime(time24) {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// Date display helper
export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' });
}

// TextInput with an inline × clear button. Supports an optional bookmark-save
// icon for place-field favourites (used by AddRequestScreen).
// Pass wrapperStyle to control layout of the outer container (e.g. flex:1).
export function ClearableInput({
  value, onChangeText, onSave, isSaved,
  style, wrapperStyle, multiline, numberOfLines, ...props
}) {
  const hasContent = value?.length > 0;
  const showSave   = !!onSave && value?.trim().length > 0 && !isSaved;
  const extraRight = hasContent ? (showSave ? 72 : 44) : 0;

  return (
    <View style={[{ position: 'relative' }, wrapperStyle]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={[style, hasContent && { paddingRight: extraRight }]}
        multiline={multiline}
        numberOfLines={numberOfLines}
        textAlignVertical={multiline ? 'top' : undefined}
        {...props}
      />
      <View style={[clearableStyles.actions, multiline && { top: 10, bottom: undefined }]}>
        {showSave && (
          <TouchableOpacity
            onPress={onSave}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Ionicons name="bookmark-outline" size={15} color={colors.primary} />
          </TouchableOpacity>
        )}
        {hasContent && (
          <TouchableOpacity
            onPress={() => onChangeText('')}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <View style={clearableStyles.circle}>
              <Text style={clearableStyles.x}>×</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const clearableStyles = StyleSheet.create({
  actions: {
    position: 'absolute', right: 10, top: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  circle: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.textTertiary,
    alignItems: 'center', justifyContent: 'center',
  },
  x: { color: colors.white, fontSize: 12, fontWeight: '700', lineHeight: 14 },
});

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontWeight: '700',
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  sectionAction: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  primaryBtn: {
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  ghostBtn: {
    paddingVertical: 13,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  ghostBtnText: {
    fontSize: 15,
    fontWeight: '500',
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
});
