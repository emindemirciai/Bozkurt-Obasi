using Bozkurt.Core.Services;
using NUnit.Framework;

namespace Bozkurt.Tests
{
    public sealed class ServiceRegistryTests
    {
        private sealed class ExampleService { }

        [Test]
        public void Register_ThenResolve_ReturnsSameInstance()
        {
            var registry = new ServiceRegistry();
            var expected = new ExampleService();
            registry.Register(expected);

            var actual = registry.Resolve<ExampleService>();

            Assert.AreSame(expected, actual);
        }

        [Test]
        public void Register_DuplicateType_Throws()
        {
            var registry = new ServiceRegistry();
            registry.Register(new ExampleService());

            Assert.Throws<System.InvalidOperationException>(() => registry.Register(new ExampleService()));
        }
    }
}
