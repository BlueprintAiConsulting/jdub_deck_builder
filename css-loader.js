export async function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith('.css') || specifier.includes('.css?')) {
    return {
      shortCircuit: true,
      url: 'data:text/javascript,export default {}'
    };
  }
  return nextResolve(specifier, context);
}
