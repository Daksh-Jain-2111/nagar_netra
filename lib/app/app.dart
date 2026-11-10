import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'theme.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/language',
    routes: [
      GoRoute(
        path: '/language',
        builder: (context, state) => const Scaffold(body: Center(child: Text('M1 Language Screen'))),
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const Scaffold(body: Center(child: Text('M2 Citizen Login Screen'))),
      ),
      GoRoute(
        path: '/officer-login',
        builder: (context, state) => const Scaffold(body: Center(child: Text('M3 Officer Login Screen'))),
      ),
      GoRoute(
        path: '/home',
        builder: (context, state) => const Scaffold(body: Center(child: Text('C1 Citizen Home Screen'))),
      ),
    ],
  );
});

class NagarNetraApp extends ConsumerWidget {
  const NagarNetraApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);
    return MaterialApp.router(
      title: 'NagarNetra (SMKMC)',
      debugShowCheckedModeBanner: false,
      theme: NagarNetraTheme.lightTheme,
      routerConfig: router,
    );
  }
}
