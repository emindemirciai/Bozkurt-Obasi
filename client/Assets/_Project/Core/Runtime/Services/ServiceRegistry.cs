using System;
using System.Collections.Generic;

namespace Bozkurt.Core.Services
{
    public sealed class ServiceRegistry
    {
        private readonly Dictionary<Type, object> _services = new();

        public void Register<TService>(TService service) where TService : class
        {
            if (service == null)
            {
                throw new ArgumentNullException(nameof(service));
            }

            var serviceType = typeof(TService);
            if (_services.ContainsKey(serviceType))
            {
                throw new InvalidOperationException($"Service already registered: {serviceType.FullName}");
            }

            _services.Add(serviceType, service);
        }

        public bool TryResolve<TService>(out TService service) where TService : class
        {
            if (_services.TryGetValue(typeof(TService), out var value) && value is TService typed)
            {
                service = typed;
                return true;
            }

            service = null;
            return false;
        }

        public TService Resolve<TService>() where TService : class
        {
            if (TryResolve<TService>(out var service))
            {
                return service;
            }

            throw new KeyNotFoundException($"Service not registered: {typeof(TService).FullName}");
        }

        public void Clear() => _services.Clear();
    }
}
