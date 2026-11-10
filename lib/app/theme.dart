import 'package:flutter/material.dart';

class NagarNetraColors {
  static const Color navy = Color(0xFF0B3D66);
  static const Color saffron = Color(0xFFE0681A);
  static const Color white = Color(0xFFFFFFFF);
  static const Color panel = Color(0xFFF4F7FA);
  static const Color border = Color(0xFFD6DFE8);
  static const Color text = Color(0xFF16212E);
  static const Color muted = Color(0xFF566475);
  static const Color green = Color(0xFF1D7A45);
  static const Color red = Color(0xFFB42318);
  static const Color amber = Color(0xFFA86A0C);
  static const Color violet = Color(0xFF5B3FA6);

  // Sovereign Tricolour Strip
  static const Color sovereignSaffron = Color(0xFFFF9933);
  static const Color sovereignWhite = Color(0xFFFFFFFF);
  static const Color sovereignGreen = Color(0xFF138808);
}

class NagarNetraTheme {
  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      fontFamily: 'Noto Sans',
      scaffoldBackgroundColor: NagarNetraColors.panel,
      primaryColor: NagarNetraColors.navy,
      colorScheme: const ColorScheme.light(
        primary: NagarNetraColors.navy,
        secondary: NagarNetraColors.saffron,
        surface: NagarNetraColors.white,
        error: NagarNetraColors.red,
        onPrimary: NagarNetraColors.white,
        onSecondary: NagarNetraColors.white,
        onSurface: NagarNetraColors.text,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: NagarNetraColors.white,
        foregroundColor: NagarNetraColors.navy,
        elevation: 0,
        centerTitle: false,
      ),
      cardTheme: CardTheme(
        color: NagarNetraColors.white,
        elevation: 0,
        shape: RoundedRectangleBorder(
          side: const BorderSide(color: NagarNetraColors.border),
          borderRadius: BorderRadius.circular(12),
        ),
      ),
    );
  }
}
