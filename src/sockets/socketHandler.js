const cartModel = require('../models/cartModel');

module.exports = (io) => {
    io.on('connection', async (socket) => {
        console.log('A user connected:', socket.id);

        // Send initial state to the newly connected client
        const activeCarts = await cartModel.getAllCarts();
        socket.emit('initial-state', activeCarts);

        // Driver goes online
        socket.on('driver-online', async (data) => {
            const { cartId } = data;
            const cart = await cartModel.getCart(cartId);
            
            if (cart) {
                await cartModel.updateCart(cartId, { 
                    driverSocketId: socket.id, 
                    isOnline: true 
                });
                
                // Join a room specific to this driver/cart for direct messages
                socket.join(`driver_${cartId}`);
                console.log(`Driver for ${cartId} is online`);
                
                const updatedCarts = await cartModel.getAllCarts();
                io.emit('cart-state-updated', updatedCarts);
            }
        });

        // Driver location update
        socket.on('update-location', async (data) => {
            const { cartId, lat, lng } = data;
            const cart = await cartModel.getCart(cartId);
            
            if (cart && cart.isOnline) {
                await cartModel.updateCart(cartId, { location: { lat, lng } });
                // Broadcast location to all clients
                io.emit('location-updated', { cartId, lat, lng });
            }
        });

        // Driver goes offline
        socket.on('driver-offline', async (data) => {
            const { cartId } = data;
            const cart = await cartModel.getCart(cartId);
            
            if (cart) {
                await cartModel.updateCart(cartId, { 
                    isOnline: false, 
                    driverSocketId: null 
                });
                const updatedCarts = await cartModel.getAllCarts();
                io.emit('cart-state-updated', updatedCarts);
            }
        });

        // Student requests a seat
        socket.on('request-seat', async (data) => {
            const { cartId, seatNumber, studentInfo, route } = data;
            const cart = await cartModel.getCart(cartId);
            
            if (cart && cart.seats[seatNumber] && cart.seats[seatNumber].status === 'available') {
                // Update specific seat in Firestore
                const seats = { ...cart.seats };
                seats[seatNumber].status = 'pending';
                await cartModel.updateCart(cartId, { seats });
                
                io.emit('seat-updated', { cartId, seatNumber, status: 'pending' });

                // Forward request to the specific driver
                if (cart.isOnline) {
                    io.to(`driver_${cartId}`).emit('ride-request', {
                        seatNumber,
                        studentInfo,
                        route,
                        requestId: socket.id // Use socket id to reply back
                    });
                } else {
                    // If driver is offline, auto-reject
                    seats[seatNumber].status = 'available';
                    await cartModel.updateCart(cartId, { seats });
                    io.emit('seat-updated', { cartId, seatNumber, status: 'available' });
                    socket.emit('request-rejected', { message: 'Driver is currently offline.' });
                }
            } else {
                socket.emit('request-rejected', { message: 'Seat is no longer available.' });
            }
        });

        // Driver confirms the ride
        socket.on('confirm-ride', async (data) => {
            const { cartId, seatNumber, requestId } = data;
            const cart = await cartModel.getCart(cartId);
            
            if (cart && cart.seats[seatNumber]) {
                const seats = { ...cart.seats };
                seats[seatNumber].status = 'occupied';
                seats[seatNumber].requestId = requestId;
                
                // Generate a 4-digit OTP for this ride
                const rideOtp = Math.floor(1000 + Math.random() * 9000).toString();
                seats[seatNumber].rideOtp = rideOtp;
                
                await cartModel.updateCart(cartId, { seats });

                // Notify all clients that the seat is now occupied
                io.emit('seat-updated', { cartId, seatNumber, status: 'occupied' });
                
                // Send the specific OTP back to the student
                io.to(requestId).emit('request-accepted', { cartId, seatNumber, rideOtp });
            }
        });

        socket.on('start-ride', async (data) => {
            const { cartId, seatNumber, otp } = data;
            const cart = await cartModel.getCart(cartId);
            
            if (cart && cart.seats[seatNumber]) {
                if (cart.seats[seatNumber].rideOtp === otp) {
                    // OTP verified! Ride can start.
                    socket.emit('ride-started-success', { seatNumber });
                } else {
                    // Incorrect OTP
                    socket.emit('ride-started-error', { seatNumber, message: 'Invalid OTP' });
                }
            }
        });

        // Driver rejects the ride
        socket.on('reject-ride', async (data) => {
            const { cartId, seatNumber, requestId } = data;
            const cart = await cartModel.getCart(cartId);
            
            if (cart) {
                const seats = { ...cart.seats };
                seats[seatNumber].status = 'available';
                await cartModel.updateCart(cartId, { seats });
                
                // Notify everyone of the seat state change
                io.emit('seat-updated', { cartId, seatNumber, status: 'available' });
                
                // Notify the specific student
                io.to(requestId).emit('request-rejected', { message: 'Driver rejected the request.' });
            }
        });

        // Driver completes the ride for a seat
        socket.on('complete-ride', async (data) => {
            const { cartId, seatNumber } = data;
            const cart = await cartModel.getCart(cartId);
            
            if (cart && cart.seats[seatNumber]) {
                const requestId = cart.seats[seatNumber].requestId;
                
                const seats = { ...cart.seats };
                seats[seatNumber].status = 'available';
                seats[seatNumber].student = null;
                seats[seatNumber].requestId = null;
                seats[seatNumber].rideOtp = null;
                
                await cartModel.updateCart(cartId, { seats });
                
                // Notify everyone
                io.emit('seat-updated', { cartId, seatNumber, status: 'available' });
                
                // Notify the specific student that the ride has ended
                if (requestId) {
                    io.to(requestId).emit('ride-completed', { message: 'Ride Ended' });
                }
            }
        });

        socket.on('disconnect', async () => {
            console.log('User disconnected:', socket.id);
            // Check if the disconnected user was a driver
            const allCarts = await cartModel.getAllCarts();
            let stateChanged = false;
            
            for (const cartId in allCarts) {
                if (allCarts[cartId].driverSocketId === socket.id) {
                    await cartModel.updateCart(cartId, {
                        isOnline: false,
                        driverSocketId: null
                    });
                    console.log(`Driver for ${cartId} went offline unexpectedly`);
                    stateChanged = true;
                }
            }
            
            if (stateChanged) {
                const updatedCarts = await cartModel.getAllCarts();
                io.emit('cart-state-updated', updatedCarts);
            }
        });
    });
};
